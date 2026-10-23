import argparse
import asyncio
import base64
import binascii
import contextlib
import enum
import logging
import re
import shutil
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import httpx
import numpy as np
from vosk import Model

from .audio import CHIME_DURATION_S, MISS_CHIME, SAMPLE_RATE, SAMPLE_WIDTH, WAKE_CHIME, MicrophoneError, Player, microphone
from .claude import ClaudeConversation, ClaudeError, attachment_block
from .config import Config, load_config
from .mcp import McpCatalog, McpSelection, scan
from .personas import ENGINE_NAMES, Persona, check_personas, load_personas, load_vocabulary, personas_signature
from .relay import Relay, RemotePlayer
from .speech import Directions, Piece, SentenceSplitter, Speech, SpeechQueue, Synthesizer, Voice, VoiceVox
from .stt import Transcriber
from .vad import VoiceActivity
from .wake import SpeechRecognizer, Utterance, Word

log = logging.getLogger("voice_agent")

# 返答の直後に続けて聞き始めるとき、読み上げの残響を声と取り違えないよう判定しない時間
FOLLOW_UP_GRACE_S = 0.4
# キャラクター設定のファイルを手で直したときに気づくまでの間隔
PERSONAS_POLL_S = 5
# 起動してから、道具の設定が届かなくても Claude Code を起動しておくまでの秒
CLAUDE_WARM_DELAY_S = 30
# マイクが無いときの再試行の間隔（最短・最長の秒）
MIC_RETRY_MIN_S = 5
MIC_RETRY_MAX_S = 300
# ブラウザで録った声を受け付ける長さの上限（画面側も同じ長さで録音を打ち切る）
BROWSER_AUDIO_MAX_S = 30
# 返答が流れてくる間に、画面へ状態を送る間隔の下限
RESPONSE_PUBLISH_S = 0.1
# ホストのマイクで聞いた声（ブラウザで録った声と区別する。続けて話す・チャイムはホストのマイクのときだけ）
HOST_MIC_SOURCES = ("wake", "follow-up", "button")
# 画面のチャットが選んだ会話のID（Claude Code の会話のIDと同じ UUID）
CONVERSATION_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def conversation_from(message: dict) -> str | None:
    value = message.get("conversationId")
    return value if isinstance(value, str) and CONVERSATION_ID.match(value) else None


def account_from(message: dict) -> str | None:
    """画面から話しかけた人のアカウントのID（サーバーが付けてくる）"""
    value = message.get("accountId")
    return value if isinstance(value, str) and value else None


def owner_from(message: dict) -> str | None:
    """話しかけた会話の持ち主（サーバーが付けてくる。家族みんなの会話は None）"""
    value = message.get("owner")
    return value if isinstance(value, str) and value else None


@dataclass
class ServerGuard:
    """
    道具を使ってよいかを、ダッシュボードのサーバー（/api/voice/guard）に決めてもらう（claude.ToolGuard）。
    話しかけ1回ごとに作り、誰がどこから何と言ったかを添える（了承の「はい」は、聞き返したのとは別の話しかけでだけ受ける）
    """

    http: httpx.AsyncClient
    conversation_id: Callable[[], str | None]
    ask_id: str
    source: str
    account_id: str | None
    utterance: str
    attachments: bool

    async def check(self, tool: str, tool_input: dict) -> dict:
        res = await self.http.post(
            "/api/voice/guard",
            json={
                "conversationId": self.conversation_id(),
                "turnId": self.ask_id,
                "source": self.source,
                "accountId": self.account_id,
                "utterance": self.utterance,
                "attachments": self.attachments,
                "tool": tool,
                "input": tool_input,
            },
        )
        res.raise_for_status()
        return res.json()

    async def wait(self, request_id: str) -> dict:
        # サーバーは1回に最長50秒待って、まだなら pending を返す
        res = await self.http.get(f"/api/voice/guard/requests/{request_id}/wait", timeout=70)
        res.raise_for_status()
        return res.json()


@dataclass(frozen=True)
class Reply:
    """
    返答の声をどこで鳴らすか。host はホストのスピーカー、browser は話しかけてきたブラウザ（client_id）、
    none は読み上げず文字だけ。画面から話しかけたときは、その端末の設定で選ばれる
    """

    speech: str = "host"
    client_id: str | None = None

    @classmethod
    def from_message(cls, message: dict) -> "Reply":
        reply = message.get("reply") if isinstance(message.get("reply"), dict) else {}
        speech = reply.get("speech")
        client_id = reply.get("clientId") if isinstance(reply.get("clientId"), str) else None
        if speech == "browser" and client_id:
            return cls("browser", client_id)
        if speech == "none":
            return cls("none")
        return cls()


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
        # インポートしたキャラクターが実際に呼べるか（語彙に無いウェイクワードなど）。画面の設定に出す
        self.persona_warnings: dict[str, list[str]] = {}
        self._personas_signature = personas_signature(config)
        self._reload_requested = False
        self._vocabulary: set[str] | None = None
        self.player = Player(config.output_cmd)
        # ダッシュボードの API はログインが要る。エージェントは VOICE_AGENT_TOKEN を添えて読む
        auth = {"Authorization": f"Bearer {config.agent_token}"} if config.agent_token else {}
        self.http = httpx.AsyncClient(base_url=config.server_url, timeout=10, headers=auth)
        self.claude = ClaudeConversation(config, self.personas, self._fetch_history)
        self.tts = Synthesizer(
            {
                "voicevox": VoiceVox(config.voicevox_url),
                "aivis": VoiceVox(config.aivisspeech_url, estimate_timing=True),
            }
        )
        self.relay = Relay(config.server_url, config.agent_token, self.snapshot, self.handle_command, self.hello)
        # Claude に使わせるコネクター・MCPサーバー（設定画面で選んだものがサーバーから届く）と、使えるものの一覧
        self.mcp_selection = McpSelection()
        self.mcp_catalog = McpCatalog()
        self._mcp_scanning = False
        self._mcp_task: asyncio.Task | None = None

        self.state = "idle"
        self.turn_id: str | None = None
        self.transcript = ""
        # チャットで添えられたファイル（記録に残す id・名前・種類）
        self.attachments: list[dict] = []
        self.response = ""
        self.error: str | None = None
        # ウェイクワード無しで続けて話せる時間帯か（返答の直後）
        self.follow_up = False
        # いま応答しているキャラクターと、どこから話しかけられたか（wake / follow-up / button / text / browser-mic）
        self.persona: Persona = self.personas.personas[0]
        self.source = "wake"
        # いまのやり取りの会話（Claude Code の会話のID）。画面のチャットは自分の会話のやり取りだけを表示する
        self.conversation_id: str | None = None
        # 画面から話しかけた人（ログインしているアカウント）。ホストのマイクでは誰か分からないので None
        self.account_id: str | None = None
        # 話しかけた会話の持ち主。自分の画面の会話はその人だけに見せる（家族みんなの会話は None）
        self.owner: str | None = None
        # 最後に答えた先（画面で了承が押されたとき、続きを同じところへ返す）
        self._last_reply = Reply()

        self.mode = Mode.IDLE
        self.turn_task: asyncio.Task | None = None
        self.recognizer: SpeechRecognizer
        self.transcriber: Transcriber
        self.vad = VoiceActivity()
        self._reset_requested = False
        # ホストのマイクで録音できているか（無いあいだは、画面のマイクボタンを受けない）
        self.mic_available = True
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
            "conversationId": self.conversation_id,
            "owner": self.owner,
            "personaWarnings": self.persona_warnings,
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
        self.vosk_model = model
        self._vocabulary = await loop.run_in_executor(None, load_vocabulary, c.vosk_model_dir)
        self.recognizer = SpeechRecognizer(model, self.personas)
        self.transcriber = await loop.run_in_executor(
            None, Transcriber, c.whisper_model, c.whisper_compute_type, self.personas.names
        )
        used = {p.engine for p in self.personas.personas}
        for name, engine in self.tts.engines.items():
            try:
                log.info("%s Engine %s", ENGINE_NAMES[name], await engine.check())
            except Exception as err:  # 起動順の都合で後から立ち上がることもあるので、ここでは止めない
                # 誰も使っていないエンジンが無いのは問題ないので、使っているものだけ知らせる
                (log.warning if name in used else log.info)(
                    "%s Engine に接続できません（%s）: %s", ENGINE_NAMES[name], engine.base_url, err
                )

        # Claude Code は、サーバーから使う道具（MCP）の設定が届いてから起動する（先に起動すると、届いた時点で
        # 起動し直しになり、起動が2回になる）。届かないとき（サーバーが止まっているなど）も、少し待って起動しておく
        asyncio.create_task(self._warm_claude())
        await self._check_personas()
        # 一覧は数秒かかるので待たずに進める（選んだものはサーバーから届いた時点で反映する）
        asyncio.create_task(self._scan_mcp())
        wake_phrases = ["".join(phrase) for p in self.personas.personas for phrase in p.wake_phrases]
        log.info("%s で待機します", "・".join(f"「{w}」" for w in wake_phrases))
        await asyncio.gather(self.relay.run(), self._listen_loop(), self._watch_personas())

    async def _warm_claude(self) -> None:
        await asyncio.sleep(CLAUDE_WARM_DELAY_S)
        try:
            await self.claude.start()
        except Exception:
            log.exception("Claude Code を起動できませんでした（最初の質問のときにもう一度試します）")

    def hello(self) -> list[dict]:
        return [self.personas_info(), self.mcp_catalog.to_message()]

    async def _scan_mcp(self) -> None:
        """このホストの Claude Code で使えるコネクター・MCPサーバーを調べ直し、画面に知らせる"""
        if self._mcp_scanning:
            return
        self._mcp_scanning = True
        try:
            catalog = await scan(self.config.claude_bin, self.config.claude_cwd)
            if catalog.error:
                log.warning("MCPサーバーの一覧が取れませんでした: %s", catalog.error)
                # 前に取れた一覧は残す（一時的に失敗しただけで、選んだものを外さない）
                catalog.servers = self.mcp_catalog.servers
            self.mcp_catalog = catalog
            await self.relay.send(catalog.to_message())
            await self._apply_mcp()
        finally:
            self._mcp_scanning = False

    async def _apply_mcp(self) -> None:
        if await self.claude.replace_mcp(self.mcp_selection, self.mcp_catalog):
            enabled = [n for n in self.mcp_selection.enabled if self.mcp_catalog.get(n)]
            enabled += [c.name for c in self.mcp_selection.custom]
            log.info("Claude が使うMCPサーバーを切り替えました: %s", "・".join(enabled) or "（ダッシュボードのみ）")

    def personas_info(self) -> dict:
        """
        画面の「動きを確認」で使う、キャラクターごとの表情（共通の表情と、身振りの推測を済ませたもの）。
        接続したときと、キャラクターを読み直したときに送る
        """
        return {
            "type": "personas-info",
            "personas": {
                persona.id: {
                    "expressions": {
                        e.name: {"avatar": e.avatar, "motion": e.motion, "speaker": e.speaker}
                        for e in persona.expressions.values()
                    }
                }
                for persona in self.personas.personas
            },
        }

    async def _check_personas(self) -> None:
        speakers = await self.tts.speaker_ids()
        self.persona_warnings = check_personas(self.personas, self._vocabulary, speakers)
        for persona_id, warnings in self.persona_warnings.items():
            for warning in warnings:
                log.warning("%s: %s", persona_id, warning)

    async def _watch_personas(self) -> None:
        """設定画面からのインポート・削除はサーバーが知らせてくるが、ファイルを手で直した場合もここで気づく"""
        loop = asyncio.get_running_loop()
        while True:
            await asyncio.sleep(PERSONAS_POLL_S)
            signature = await loop.run_in_executor(None, personas_signature, self.config)
            if signature != self._personas_signature:
                self._reload_requested = True

    async def _reload_personas(self) -> None:
        """
        キャラクターを読み直す。ウェイクワードの文法・書き起こしから落とす名前・Claude への設定をまとめて差し替える。
        Claude はシステムプロンプトに全員の設定を持っているので新しい会話にする（直近のやり取りは記録から引き継がれる）
        """
        loop = asyncio.get_running_loop()
        self._reload_requested = False
        self._personas_signature = await loop.run_in_executor(None, personas_signature, self.config)
        personas = await loop.run_in_executor(None, load_personas, self.config)
        self.personas = personas
        self.recognizer = SpeechRecognizer(self.vosk_model, personas)
        self._chime_until = 0.0
        self.transcriber.set_names(personas.names)
        self.persona = personas.get(self.persona.id)
        await self.claude.replace_personas(personas)
        await self._check_personas()
        log.info("キャラクターを読み直しました: %s", "・".join(p.name for p in personas.personas))
        await self.relay.publish()
        await self.relay.send(self.personas_info())

    async def _listen_loop(self) -> None:
        loop = asyncio.get_running_loop()
        # マイクが無いあいだの再試行の間隔。失敗が続くほど延ばし（最長5分）、同じ失敗はログに出し続けない
        retry_s = MIC_RETRY_MIN_S
        failures = 0
        while True:
            try:
                async for chunk in microphone(self.config.input_cmd):
                    if failures:
                        log.info("マイクで録音できるようになりました（%d回失敗した後）", failures)
                        failures, retry_s = 0, MIC_RETRY_MIN_S
                        self.mic_available = True
                    # 応答や聞き取りの途中で文法やキャラクターを差し替えないよう、待機中になってから読み直す
                    if self._reload_requested and self.mode is Mode.IDLE and self._listen_request is None:
                        await self._reload_personas()
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
                failures += 1
                self.mic_available = False
                if failures == 1:
                    log.error("%s（%d秒後に再試行。続くあいだは間隔を延ばし、ログは間隔が変わるときだけ出す）", err, retry_s)
                elif retry_s < MIC_RETRY_MAX_S:
                    log.warning("まだマイクで録音できません（%d回目。次は%d秒後）", failures, retry_s)
                waited = 0.0
                while waited < retry_s:
                    # マイクが無くても画面からは話しかけられるので、キャラクターの変更はここでも反映する
                    if self._reload_requested and self.mode is Mode.IDLE:
                        await self._reload_personas()
                    await asyncio.sleep(MIC_RETRY_MIN_S)
                    waited += MIC_RETRY_MIN_S
                retry_s = min(retry_s * 2, MIC_RETRY_MAX_S)

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
        self.account_id = None
        self.owner = None
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

    def _start_turn(
        self,
        *,
        audio: bytes | None = None,
        text: str | None = None,
        reply: Reply = Reply(),
        conversation_id: str | None = None,
        attachments: list[dict] | None = None,
    ) -> None:
        """conversation_id は画面のチャットで選んだ会話（無ければ今の会話で答える）。attachments はチャットに添えたファイル"""
        self.mode = Mode.BUSY
        self.attachments = attachments or []
        self._last_reply = reply
        self.turn_task = asyncio.create_task(
            self._run_turn(
                audio, text, persona=self.persona, follow_up=self.follow_up, reply=reply, conversation_id=conversation_id
            )
        )

    async def _fetch_history(self, owner: str | None) -> list[dict]:
        """新しい会話に添える記録。家族みんなの会話と、持ち主がいればその人の会話だけ"""
        params: dict[str, str | int] = {"limit": self.config.history_turns}
        if owner:
            params["owner"] = owner
        res = await self.http.get("/api/voice/history", params=params)
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
                    # 誰の会話か（サーバーは、持ち主の画面にだけ見せる）
                    "owner": self.claude.owner,
                    # ゲストモードの間は、サーバーが記録に残さない
                    "guest": self.claude.guest,
                    "persona": {"id": persona.id, "name": persona.name},
                    "input": {
                        "source": self.source,
                        "text": self.transcript,
                        **({"attachments": self.attachments} if self.attachments else {}),
                    },
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

    async def _load_attachments(self) -> list[dict]:
        """チャットに添えられたファイルをサーバーから取ってきて、Claude に見せるブロックにする"""
        blocks = []
        for item in self.attachments:
            try:
                res = await self.http.get(f"/api/voice/attachments/{item['id']}", timeout=30)
                res.raise_for_status()
            except httpx.HTTPError as err:
                raise ClaudeError(f"添えられたファイル（{item.get('name')}）を読めませんでした: {err}") from None
            blocks.append(attachment_block(item.get("kind", "text"), item.get("name", "file"), item.get("type", ""), res.content))
        return blocks

    async def _run_turn(
        self,
        audio: bytes | None,
        text: str | None,
        *,
        persona: Persona,
        follow_up: bool,
        reply: Reply,
        conversation_id: str | None = None,
    ) -> None:
        loop = asyncio.get_running_loop()
        speech: SpeechQueue | None = None
        listen_again = False
        host_mic = audio is not None and self.source in HOST_MIC_SOURCES
        try:
            if audio is not None:
                if not host_mic:
                    # ブラウザで録った声は、聞き始めを経ずにここから始まるので、新しいやり取りにする
                    await self.update(turn_id=uuid.uuid4().hex[:8], transcript="", response="", error=None)
                await self.update(state="transcribing", follow_up=False, conversation_id=conversation_id)
                text = await loop.run_in_executor(None, self.transcriber.transcribe, audio)
                log.info("書き起こし: %r", text)
                if not text and follow_up:
                    # 返答の後に拾った物音（相づちやテレビの音）で「聞き取れませんでした」を出すとうるさいので、黙って戻る
                    await self.update(state="idle")
                    return
                if not text:
                    await self.update(state="error", error="聞き取れませんでした")
                    if self.config.chime and host_mic:
                        await self.player.play(MISS_CHIME)
                    return
            else:
                await self.update(turn_id=uuid.uuid4().hex[:8], error=None, follow_up=False, conversation_id=conversation_id)

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
                        "beats": sentence.beats,
                        "durationS": sentence.duration_s,
                        "expression": (
                            {"name": expression.name, "avatar": expression.avatar, "motion": expression.motion}
                            if expression
                            else None
                        ),
                    }
                )

            if reply.speech == "browser" and reply.client_id:
                player: Player | RemotePlayer = RemotePlayer(self.relay, reply.client_id, self.turn_id)
            else:
                player = self.player
            # 文字だけで返すときは読み上げない（画面のアバターも口を動かさない）
            if reply.speech != "none":
                speech = SpeechQueue(self.tts, Voice(persona.speaker, persona.speed, persona.engine), player, on_play)
            # 返答の（表情名）は表情と声のトーンの指定。画面にも読み上げにも出さない
            directions = Directions(persona.expressions, hide_descriptions=self.personas.has_characters)
            splitter = SentenceSplitter(directions)
            raw_response = ""
            assert text is not None
            blocks = await self._load_attachments()
            asked_at = time.monotonic()
            first_delta_s: float | None = None
            # 画面へ送る返答は間引く（差分ごとに状態をまるごと送ると、長い返答ほど送る量と整形が膨らむ）
            last_published = 0.0
            # 中止されたときに Claude 側の後始末（読みかけの応答を捨てる）が確実に走るよう、明示的に閉じる
            guard = ServerGuard(
                self.http,
                lambda: self.claude.session_id,
                ask_id=uuid.uuid4().hex,
                source=self.source,
                account_id=self.account_id,
                utterance=text,
                attachments=bool(blocks),
            )
            stream_ask = self.claude.ask(text, persona, conversation_id, blocks, guard, owner=self.owner)
            async with contextlib.aclosing(stream_ask) as stream:
                async for delta in stream:
                    if first_delta_s is None and delta.strip():
                        first_delta_s = time.monotonic() - asked_at
                        # ウェイクワードで話しかけたときは、答え始めるまでどの会話か（間が空いて新しくなったか）が決まらない
                        await self.update(conversation_id=self.claude.session_id)
                    raw_response += delta
                    now = time.monotonic()
                    if now - last_published >= RESPONSE_PUBLISH_S:
                        last_published = now
                        await self.update(response=directions.visible(raw_response))
                    for piece in splitter.feed(delta):
                        self._segments.append(piece)
                        if speech:
                            speech.say(piece)
            await self.update(response=directions.visible(raw_response))
            for piece in splitter.flush():
                self._segments.append(piece)
                if speech:
                    speech.say(piece)
            log.info(
                "返答（最初の文字まで%.1f秒、全体%.1f秒）: %r",
                first_delta_s or 0,
                time.monotonic() - asked_at,
                raw_response.strip(),
            )
            if speech:
                await speech.finish()
            self.response = self.response.strip()
            await self._record_turn(persona, "answered")
            # ホストのマイクに声で話しかけられたときだけ、ウェイクワード無しで続けて話せるようにする
            # （画面から文字で聞いた人が続けて声で話すことはまず無く、ブラウザで話した人はホストのマイクの前にいるとは限らない）
            if host_mic and self.config.follow_up_s > 0:
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
        if kind == "ask" and isinstance(message.get("text"), str) and (message["text"].strip() or message.get("attachments")):
            await self._cancel_turn()
            text = message["text"].strip()
            attachments = [
                {key: str(a.get(key, "")) for key in ("id", "name", "type", "kind")}
                for a in message.get("attachments") or []
                if isinstance(a, dict) and isinstance(a.get("id"), str)
            ][:5]
            # 「@カリン」と書けば、選んでいるキャラクターに関わらずそのキャラクターが答える
            self.persona = self.personas.mentioned(text) or self.personas.get(message.get("personaId"))
            self.source = "text"
            self.account_id = account_from(message)
            self.owner = owner_from(message)
            self._start_turn(
                text=text,
                reply=Reply.from_message(message),
                conversation_id=conversation_from(message),
                attachments=attachments,
            )
        elif kind == "ask-audio" and isinstance(message.get("audio"), str):
            # ブラウザのマイクで録った声（16kHz mono s16le を base64 にしたもの）
            try:
                audio = base64.b64decode(message["audio"], validate=True)
            except binascii.Error:
                log.warning("ブラウザから届いた音声を読めませんでした")
                return
            if not audio or len(audio) > BROWSER_AUDIO_MAX_S * SAMPLE_RATE * SAMPLE_WIDTH:
                log.warning("ブラウザから届いた音声の長さが範囲外です（%dバイト）", len(audio))
                return
            audio = audio[: len(audio) - len(audio) % SAMPLE_WIDTH]
            # 書き起こしが空になったときに、端末のマイクの音が入っていたかを見分けられるようにしておく
            peak = int(np.abs(np.frombuffer(audio, np.int16).astype(np.int32)).max()) / 32768
            log.info("ブラウザから声が届きました（%.1f秒、最大音量 %.3f）", len(audio) / SAMPLE_WIDTH / SAMPLE_RATE, peak)
            await self._cancel_turn()
            self.persona = self.personas.get(message.get("personaId"))
            self.source = "browser-mic"
            self.account_id = account_from(message)
            self.owner = owner_from(message)
            self.follow_up = False
            self._start_turn(audio=audio, reply=Reply.from_message(message), conversation_id=conversation_from(message))
        elif kind == "cancel":
            await self._cancel_turn()
            await self.update(state="idle", follow_up=False)
        elif kind == "privacy":
            # ゲストモードの入／切。記録の残らない新しい会話に切り替える
            asyncio.create_task(self.claude.set_guest(message.get("guest") is True))
        elif kind == "guard-confirmed":
            # 聞き返した操作を、画面で了承された。声で「はい」と答えたのと同じに、続きをさせる
            if message.get("conversationId") != self.claude.session_id or self.mode != Mode.IDLE:
                return
            self.source = "text"
            # 同じ会話の続きなので、持ち主も、家の人の情報を出してよい相手もその会話のまま
            self.owner = self.claude.owner
            self.account_id = self.claude.owner
            self._start_turn(
                text="はい（画面で了承しました）",
                reply=self._last_reply,
                conversation_id=self.claude.session_id,
            )
        elif kind == "mcp-settings":
            # 設定画面で選んだコネクター・MCPサーバー。つなぐたびと、変えたときに届く
            self.mcp_selection = McpSelection.from_message(message)
            self._mcp_task = asyncio.create_task(self._apply_mcp())
        elif kind == "mcp-scan":
            asyncio.create_task(self._scan_mcp())
        elif kind == "reload-personas":
            # 設定画面でキャラクターをインポート・削除した
            self._reload_requested = True
        elif kind == "listen":
            # 画面のマイクボタン。ウェイクワード無しで聞き始める（読み上げ中なら止めて聞く）
            await self._cancel_turn()
            if not self.mic_available:
                # 聞き始めの頼みを残すと、マイクが戻るまでキャラクターの読み直しも止まるので、受けずに知らせる
                await self.update(state="error", error="このホストのマイクで録音できません（マイクがつながっているか確かめてください）")
                return
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
