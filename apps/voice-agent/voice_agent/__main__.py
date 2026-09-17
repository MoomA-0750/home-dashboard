import argparse
import asyncio
import contextlib
import enum
import logging
import shutil
import time
import uuid
from datetime import datetime

import httpx
from vosk import Model

from .audio import CHIME_DURATION_S, MISS_CHIME, WAKE_CHIME, MicrophoneError, Player, microphone
from .claude import ClaudeConversation, ClaudeError
from .config import Config, load_config
from .personas import Persona, load_personas
from .relay import Relay
from .speech import Directions, Piece, SentenceSplitter, Speech, SpeechQueue, Voice, VoiceVox
from .stt import Transcriber
from .vad import VoiceActivity
from .wake import SpeechRecognizer, Utterance, Word

log = logging.getLogger("voice_agent")

# 返答の直後に続けて聞き始めるとき、読み上げの残響を声と取り違えないよう判定しない時間
FOLLOW_UP_GRACE_S = 0.4


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

    ウェイクワードごとにキャラクター（personas.py）を呼び分ける。呼ばれたキャラクターの声で読み上げ、
    やり取りのたびに「誰が・どこから聞かれて・何に答えたか」をサーバーに送って記録してもらう。
    """

    def __init__(self, config: Config) -> None:
        self.config = config
        self.personas = load_personas(config)
        self.player = Player(config.output_cmd)
        self.http = httpx.AsyncClient(base_url=config.server_url, timeout=10)
        self.claude = ClaudeConversation(config, self.personas, self._fetch_history)
        self.tts = VoiceVox(config.voicevox_url)
        self.relay = Relay(config.server_url, config.agent_token, self.snapshot, self.handle_command)

        self.state = "idle"
        self.turn_id: str | None = None
        self.transcript = ""
        self.response = ""
        self.error: str | None = None
        # ウェイクワード無しで続けて話せる時間帯か（返答の直後）
        self.follow_up = False
        # いま応答しているキャラクターと、どこから話しかけられたか（wake / follow-up / button / text）
        self.persona: Persona = self.personas.personas[0]
        self.source = "wake"

        self.mode = Mode.IDLE
        self.turn_task: asyncio.Task | None = None
        self.recognizer: SpeechRecognizer
        self.transcriber: Transcriber
        self.vad = VoiceActivity()
        self._reset_requested = False
        # 次の音声チャンクを処理する前に聞き取りを始める（画面のマイクボタン・返答後の続けて話す）
        self._listen_request: dict | None = None
        self._listen_timeout = 0.0
        # 返答の区切りごとの表情と文（記録に残す）
        self._segments: list[Piece] = []
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
            "followUp": self.follow_up,
            "personaId": self.persona.id,
            "personaName": self.persona.name,
        }

    async def update(self, **fields) -> None:
        for key, value in fields.items():
            # 綴り間違いで画面に届かない属性を作らないよう、既存の属性だけを受け付ける
            if not hasattr(self, key):
                raise AttributeError(key)
            setattr(self, key, value)
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
        self.recognizer = SpeechRecognizer(model, self.personas)
        self.transcriber = await loop.run_in_executor(
            None, Transcriber, c.whisper_model, c.whisper_compute_type, self.personas.names
        )
        try:
            log.info("VOICEVOX Engine %s", await self.tts.check())
        except Exception as err:  # 起動順の都合で後から立ち上がることもあるので、ここでは止めない
            log.warning("VOICEVOX Engine に接続できません（%s）: %s", c.voicevox_url, err)

        await self.claude.start()
        wake_phrases = ["".join(phrase) for p in self.personas.personas for phrase in p.wake_phrases]
        log.info("%s で待機します", "・".join(f"「{w}」" for w in wake_phrases))
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
                    # 認識器のリセットと同じループの中で始めることで、聞き取りの開始時刻が認識器の時刻とずれないようにする
                    if (request := self._listen_request) is not None and self.mode is not Mode.BUSY:
                        self._listen_request = None
                        now = self.recognizer.now
                        await self._begin_listening(
                            now,
                            now,
                            [],
                            persona=self.personas.get(request.get("persona_id")),
                            source=request.get("source", "button"),
                            follow_up=request.get("follow_up", False),
                        )
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
        hit = self.recognizer.find_wake(utterance)
        if hit is None:
            return
        persona = self.personas.get(hit.persona_id)
        log.info("%sのウェイクワードを検出しました: %s", persona.name, " ".join(w.word for w in utterance.words))
        # 「ねえプラム、電気消して」と続けて言われた場合は、ウェイクワードの後ろがもう命令になっている
        await self._begin_listening(hit.start, hit.end, hit.rest, persona=persona, source="wake")

    async def _begin_listening(
        self,
        wake_start: float,
        start: float,
        words: list[Word],
        *,
        persona: Persona,
        source: str,
        follow_up: bool = False,
    ) -> None:
        c = self.config
        self.persona = persona
        self.source = source
        self.mode = Mode.LISTENING
        self._wake_start = wake_start
        self._listen_start = start
        self._heard_voice = bool(words)
        self._last_voice = words[-1].end if words else start
        self._listen_timeout = c.follow_up_s if follow_up else c.listen_timeout_s
        if follow_up:
            # 読み上げが終わった直後はスピーカーの残響が残っているので、少しの間は声と判定しない。
            # 直前の返答は読み終わるまで画面に残しておきたいので消さない
            self._chime_until = self.recognizer.now + FOLLOW_UP_GRACE_S
            await self.update(state="listening", follow_up=True, error=None)
            return
        await self.update(
            state="listening", turn_id=uuid.uuid4().hex[:8], transcript="", response="", error=None, follow_up=False
        )
        if not words and c.chime:
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
            if now - self._listen_start >= self._listen_timeout:
                await self._give_up_listening()
        elif now - self._last_voice >= c.end_silence_s:
            self._start_turn(audio=self.recognizer.audio(self._wake_start, self._last_voice))
        elif now - self._listen_start >= c.max_utterance_s:
            self._start_turn(audio=self.recognizer.audio(self._wake_start, now))

    async def _give_up_listening(self) -> None:
        log.info("命令が聞こえなかったので待機に戻ります")
        self.mode = Mode.IDLE
        self._reset_requested = True
        await self.update(state="idle", follow_up=False)

    def _start_turn(self, *, audio: bytes | None = None, text: str | None = None) -> None:
        self.mode = Mode.BUSY
        self.turn_task = asyncio.create_task(self._run_turn(audio, text, persona=self.persona, follow_up=self.follow_up))

    async def _fetch_history(self) -> list[dict]:
        res = await self.http.get("/api/voice/history", params={"limit": self.config.history_turns})
        res.raise_for_status()
        return res.json()["records"]

    async def _record_turn(self, persona: Persona, status: str) -> None:
        """誰に・どこから・何と話しかけられ、どの表情で何と答えたかを、構造化してサーバーに記録してもらう"""
        await self.relay.send(
            {
                "type": "turn",
                "record": {
                    "id": self.turn_id,
                    "at": datetime.now().astimezone().isoformat(timespec="seconds"),
                    "conversationId": self.claude.session_id,
                    "persona": {"id": persona.id, "name": persona.name},
                    "input": {"source": self.source, "text": self.transcript},
                    "output": {
                        "text": self.response.strip(),
                        "segments": [
                            {"expression": p.expression.name if p.expression else None, "text": p.text}
                            for p in self._segments
                        ],
                    },
                    "status": status,
                },
            }
        )

    async def _run_turn(self, audio: bytes | None, text: str | None, *, persona: Persona, follow_up: bool) -> None:
        loop = asyncio.get_running_loop()
        speech: SpeechQueue | None = None
        listen_again = False
        try:
            if audio is not None:
                await self.update(state="transcribing", follow_up=False)
                text = await loop.run_in_executor(None, self.transcriber.transcribe, audio)
                log.info("書き起こし: %r", text)
                if not text and follow_up:
                    # 返答の後に拾った物音（相づちやテレビの音）で「聞き取れませんでした」を出すとうるさいので、黙って戻る
                    await self.update(state="idle")
                    return
                if not text:
                    await self.update(state="error", error="聞き取れませんでした")
                    if self.config.chime:
                        await self.player.play(MISS_CHIME)
                    return
            else:
                await self.update(turn_id=uuid.uuid4().hex[:8], error=None, follow_up=False)

            await self.update(state="thinking", transcript=text, response="")
            self._segments = []

            async def on_play(sentence: Speech, first: bool) -> None:
                if first:
                    log.info("読み上げ開始（質問から%.1f秒）", time.monotonic() - asked_at)
                    await self.update(state="speaking")
                # 画面のアバターは、これを受け取った時刻を再生開始とみなして口を動かし、表情を変える
                expression = sentence.expression
                await self.relay.send(
                    {
                        "type": "lipsync",
                        "turnId": self.turn_id,
                        "cues": sentence.mouth_cues,
                        "durationS": sentence.duration_s,
                        "expression": {"name": expression.name, "avatar": expression.avatar} if expression else None,
                    }
                )

            speech = SpeechQueue(self.tts, Voice(persona.speaker, persona.speed), self.player, on_play)
            # 返答の（表情名）は表情と声のトーンの指定。画面にも読み上げにも出さない
            directions = Directions(persona.expressions, hide_descriptions=self.personas.has_characters)
            splitter = SentenceSplitter(directions)
            raw_response = ""
            assert text is not None
            asked_at = time.monotonic()
            first_delta_s: float | None = None
            # 中止されたときに Claude 側の後始末（読みかけの応答を捨てる）が確実に走るよう、明示的に閉じる
            async with contextlib.aclosing(self.claude.ask(text, persona)) as stream:
                async for delta in stream:
                    if first_delta_s is None and delta.strip():
                        first_delta_s = time.monotonic() - asked_at
                    raw_response += delta
                    await self.update(response=directions.visible(raw_response))
                    for piece in splitter.feed(delta):
                        self._segments.append(piece)
                        speech.say(piece)
            for piece in splitter.flush():
                self._segments.append(piece)
                speech.say(piece)
            log.info(
                "返答（最初の文字まで%.1f秒、全体%.1f秒）: %r",
                first_delta_s or 0,
                time.monotonic() - asked_at,
                raw_response.strip(),
            )
            await speech.finish()
            self.response = self.response.strip()
            await self._record_turn(persona, "answered")
            # 声で話しかけられたときだけ、ウェイクワード無しで続けて話せるようにする
            # （画面から文字で聞いた人が、続けて声で話すことはまず無い）
            if audio is not None and self.config.follow_up_s > 0:
                listen_again = True
            else:
                await self.update(state="idle")
        except asyncio.CancelledError:
            if self.state in ("thinking", "speaking"):
                await self._record_turn(persona, "cancelled")
            await self.update(state="idle")
            raise
        except ClaudeError as err:
            log.error("%s", err)
            await self.update(state="error", error=str(err))
            await self._record_turn(persona, "error")
        except Exception as err:
            log.exception("応答中にエラーが発生しました")
            await self.update(state="error", error=f"応答中にエラーが発生しました: {err}")
            await self._record_turn(persona, "error")
        finally:
            if speech:
                speech.cancel()
            self.mode = Mode.IDLE
            self._reset_requested = True
            if listen_again:
                self._listen_request = {"follow_up": True, "persona_id": persona.id, "source": "follow-up"}

    async def handle_command(self, message: dict) -> None:
        """画面側からの操作（サーバー経由）"""
        kind = message.get("type")
        if kind == "ask" and isinstance(message.get("text"), str) and message["text"].strip():
            await self._cancel_turn()
            self.persona = self.personas.get(message.get("personaId"))
            self.source = "text"
            self._start_turn(text=message["text"].strip())
        elif kind == "cancel":
            await self._cancel_turn()
            await self.update(state="idle", follow_up=False)
        elif kind == "listen":
            # 画面のマイクボタン。ウェイクワード無しで聞き始める（読み上げ中なら止めて聞く）
            await self._cancel_turn()
            self._listen_request = {"persona_id": message.get("personaId"), "source": "button"}

    async def _cancel_turn(self) -> None:
        self._listen_request = None
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
