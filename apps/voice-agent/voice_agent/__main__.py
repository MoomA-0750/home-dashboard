import argparse
import asyncio
import contextlib
import enum
import logging
import shutil
import uuid

from vosk import Model

from .audio import CHIME_DURATION_S, MISS_CHIME, WAKE_CHIME, MicrophoneError, Player, microphone
from .claude import ClaudeConversation, ClaudeError
from .config import Config, load_config
from .relay import Relay
from .speech import SentenceSplitter, SpeechQueue, VoiceVox
from .stt import Transcriber
from .vad import VoiceActivity
from .wake import SpeechRecognizer, Utterance, Word

log = logging.getLogger("voice_agent")


class Mode(enum.Enum):
    # ウェイクワード待ち
    IDLE = enum.auto()
    # ウェイクワードを聞いて、命令の発話が終わるのを待っている
    LISTENING = enum.auto()
    # 書き起こし〜Claude〜読み上げ中。マイクの音は捨てる（自分の読み上げ音声でウェイクワードを誤検出しないため）
    BUSY = enum.auto()


class Assistant:
    """
    マイク → ウェイクワード検出（Vosk）→ 命令の録音 → 書き起こし（whisper）→ Claude Code → 読み上げ（VOICEVOX）
    を回す本体。画面に出す状態（state/transcript/response/error）はここが持ち、変わるたびにサーバーへ送る。
    """

    def __init__(self, config: Config) -> None:
        self.config = config
        self.player = Player(config.output_cmd)
        self.claude = ClaudeConversation(config)
        self.tts = VoiceVox(config.voicevox_url, config.voicevox_speaker, config.voicevox_speed)
        self.relay = Relay(config.server_url, config.agent_token, self.snapshot, self.handle_command)

        self.state = "idle"
        self.turn_id: str | None = None
        self.transcript = ""
        self.response = ""
        self.error: str | None = None

        self.mode = Mode.IDLE
        self.turn_task: asyncio.Task | None = None
        self.recognizer: SpeechRecognizer
        self.transcriber: Transcriber
        self.vad = VoiceActivity()
        self._reset_requested = False
        self._chime_until = 0.0
        # ウェイクワードを言い始めた/言い終えた時刻、命令の声が聞こえ始めたか、最後に声が聞こえた時刻（いずれも認識器の時刻）
        self._wake_start = 0.0
        self._listen_start = 0.0
        self._heard_voice = False
        self._last_voice = 0.0

    def snapshot(self) -> dict:
        return {
            "state": self.state,
            "turnId": self.turn_id,
            "transcript": self.transcript,
            "response": self.response,
            "error": self.error,
            "wakePhrase": "".join(self.config.wake_phrase),
        }

    async def update(self, **fields) -> None:
        for key, value in fields.items():
            setattr(self, {"turnId": "turn_id"}.get(key, key), value)
        await self.relay.publish()

    async def run(self) -> None:
        c = self.config
        loop = asyncio.get_running_loop()
        if not c.vosk_model_dir.exists():
            raise SystemExit(f"Voskのモデルがありません: {c.vosk_model_dir}（README の「音声アシスタント」参照）")
        if not shutil.which(c.claude_bin):
            log.warning("claude コマンドが見つかりません（VOICE_CLAUDE_BIN=%s）", c.claude_bin)

        log.info("モデルを読み込んでいます（Vosk: %s / whisper: %s）", c.vosk_model_dir.name, c.whisper_model)
        model = await loop.run_in_executor(None, Model, str(c.vosk_model_dir))
        self.recognizer = SpeechRecognizer(model, c.wake_phrase, c.wake_decoys)
        self.transcriber = await loop.run_in_executor(None, Transcriber, c.whisper_model, c.whisper_compute_type)
        try:
            log.info("VOICEVOX Engine %s", await self.tts.check())
        except Exception as err:  # 起動順の都合で後から立ち上がることもあるので、ここでは止めない
            log.warning("VOICEVOX Engine に接続できません（%s）: %s", c.voicevox_url, err)

        log.info("「%s」で待機します", "".join(c.wake_phrase))
        await asyncio.gather(self.relay.run(), self._listen_loop())

    async def _listen_loop(self) -> None:
        loop = asyncio.get_running_loop()
        while True:
            try:
                async for chunk in microphone(self.config.input_cmd):
                    if self._reset_requested:
                        self._reset_requested = False
                        self.recognizer.reset()
                        # 認識器の時刻は作り直すと0から数え直しになるので、前の時刻で決めた区間も捨てる
                        self._chime_until = 0.0
                    if self.mode is Mode.BUSY:
                        continue
                    utterance, voice = await loop.run_in_executor(None, self._process_chunk, chunk)
                    if self.mode is Mode.IDLE:
                        await self._on_idle_audio(utterance)
                    elif self.mode is Mode.LISTENING:
                        await self._on_listening_audio(voice)
            except MicrophoneError as err:
                log.error("%s（5秒後に再試行）", err)
                await asyncio.sleep(5)

    def _process_chunk(self, chunk: bytes) -> tuple[Utterance | None, bool]:
        utterance = self.recognizer.feed(chunk)
        self.vad.push(chunk)
        # 声の有無は命令を聞いている間だけ使う（待機中はVoskの区切りで足りるので計算しない）。
        # チャイムが鳴っている間は、スピーカーからの回り込みを声と取り違えないよう判定しない
        voice = self.mode is Mode.LISTENING and self.recognizer.now >= self._chime_until and self.vad.is_speech()
        return utterance, voice

    async def _on_idle_audio(self, utterance: Utterance | None) -> None:
        if utterance is None:
            return
        wake_index = self.recognizer.find_wake(utterance)
        if wake_index is None:
            return
        log.info("ウェイクワードを検出しました: %s", " ".join(w.word for w in utterance.words))
        words = utterance.words
        wake_start = words[wake_index - len(self.config.wake_phrase) + 1].start
        # 「ねえクロード、電気消して」と続けて言われた場合は、ウェイクワードの後ろがもう命令になっている
        await self._begin_listening(wake_start, words[wake_index].end, words[wake_index + 1 :])

    async def _begin_listening(self, wake_start: float, start: float, words: list[Word]) -> None:
        self.mode = Mode.LISTENING
        self._wake_start = wake_start
        self._listen_start = start
        self._heard_voice = bool(words)
        self._last_voice = words[-1].end if words else start
        await self.update(state="listening", turnId=uuid.uuid4().hex[:8], transcript="", response="", error=None)
        if not words and self.config.chime:
            self._chime_until = self.recognizer.now + CHIME_DURATION_S + 0.2
            asyncio.create_task(self.player.play(WAKE_CHIME))

    async def _on_listening_audio(self, voice: bool) -> None:
        c = self.config
        now = self.recognizer.now
        if voice:
            self._heard_voice = True
            self._last_voice = now

        # 命令はウェイクワードごと切り出してwhisperに渡し、書き起こし結果からウェイクワードを落とす。
        # - 声が出始めた時刻で切ると、VADが反応するまでの語頭が欠ける
        #   （Voskが「ねえクロード」の直後で区切り、間髪入れず命令が続いた場合に起きた）
        # - 命令だけを渡すより、ウェイクワードから続けて聞かせた方が短い命令の認識が安定する
        #   （実測: 命令だけでは「電気を消して」→「レンキを消して」、ウェイクワードごとなら正しく取れた）
        # 間に挟まる無音はwhisper側のVADフィルタが落とす
        if not self._heard_voice:
            if now - self._listen_start >= c.listen_timeout_s:
                await self._give_up_listening()
        elif now - self._last_voice >= c.end_silence_s:
            self._start_turn(audio=self.recognizer.audio(self._wake_start, self._last_voice))
        elif now - self._listen_start >= c.max_utterance_s:
            self._start_turn(audio=self.recognizer.audio(self._wake_start, now))

    async def _give_up_listening(self) -> None:
        log.info("命令が聞こえなかったので待機に戻ります")
        self.mode = Mode.IDLE
        self._reset_requested = True
        await self.update(state="idle")

    def _start_turn(self, *, audio: bytes | None = None, text: str | None = None) -> None:
        self.mode = Mode.BUSY
        self.turn_task = asyncio.create_task(self._run_turn(audio, text))

    async def _run_turn(self, audio: bytes | None, text: str | None) -> None:
        loop = asyncio.get_running_loop()
        speech: SpeechQueue | None = None
        try:
            if audio is not None:
                await self.update(state="transcribing")
                text = await loop.run_in_executor(None, self.transcriber.transcribe, audio)
                log.info("書き起こし: %r", text)
                if not text:
                    await self.update(state="error", error="聞き取れませんでした")
                    if self.config.chime:
                        await self.player.play(MISS_CHIME)
                    return
            else:
                await self.update(turnId=uuid.uuid4().hex[:8], error=None)

            await self.update(state="thinking", transcript=text, response="")

            async def on_first_audio() -> None:
                await self.update(state="speaking")

            speech = SpeechQueue(self.tts, self.player, on_first_audio)
            splitter = SentenceSplitter()
            assert text is not None
            async for delta in self.claude.ask(text):
                self.response += delta
                await self.relay.publish()
                for sentence in splitter.feed(delta):
                    speech.say(sentence)
            for sentence in splitter.flush():
                speech.say(sentence)
            log.info("返答: %r", self.response.strip())
            await speech.finish()
            await self.update(state="idle", response=self.response.strip())
        except asyncio.CancelledError:
            await self.update(state="idle")
            raise
        except ClaudeError as err:
            log.error("%s", err)
            await self.update(state="error", error=str(err))
        except Exception as err:
            log.exception("応答中にエラーが発生しました")
            await self.update(state="error", error=f"応答中にエラーが発生しました: {err}")
        finally:
            if speech:
                speech.cancel()
            self.mode = Mode.IDLE
            self._reset_requested = True

    async def handle_command(self, message: dict) -> None:
        """画面側からの操作（サーバー経由）"""
        kind = message.get("type")
        if kind == "ask" and isinstance(message.get("text"), str) and message["text"].strip():
            await self._cancel_turn()
            self._start_turn(text=message["text"].strip())
        elif kind == "cancel":
            await self._cancel_turn()
            await self.update(state="idle")

    async def _cancel_turn(self) -> None:
        task = self.turn_task
        if task and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self.player.stop()
        self.mode = Mode.IDLE
        self._reset_requested = True


def main() -> None:
    parser = argparse.ArgumentParser(description="home-dashboard の音声アシスタント")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()
    logging.basicConfig(level=args.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(Assistant(load_config()).run())


if __name__ == "__main__":
    main()
