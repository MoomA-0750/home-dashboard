import asyncio
import base64
import json
import logging
from collections.abc import Awaitable, Callable

import websockets

from .audio import wav_duration_s

log = logging.getLogger(__name__)

# 再接続の間隔。切れるたびに倍にし、上限で止める（サーバーが止まっている間、ログと接続の試みで埋めない）
RETRY_S = 5
RETRY_MAX_S = 60


class Relay:
    """
    ダッシュボードのサーバーとつなぐWebSocket。
    こちらからは状態のスナップショットを送り（サーバーが画面に配信する）、
    サーバーからは画面上の操作（テキストで質問・キャンセル）を受け取る。
    状態の正はこのエージェント側にあり、再接続したら最新のスナップショットを送り直す。
    """

    def __init__(
        self,
        server_url: str,
        token: str,
        snapshot: Callable[[], dict],
        on_command: Callable[[dict], Awaitable[None]],
        hello: Callable[[], list[dict]] | None = None,
    ) -> None:
        """hello は、接続するたびに状態と一緒に送る情報（キャラクターの表情の一覧・使えるMCPサーバーの一覧など）"""
        ws_base = server_url.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        self._url = f"{ws_base}/ws/voice-agent"
        # トークンは URL ではなくヘッダーで渡す（URL はサーバーのアクセスのログに残る）
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._snapshot = snapshot
        self._on_command = on_command
        self._hello = hello
        self._ws: websockets.ClientConnection | None = None

    async def run(self) -> None:
        retry_s = RETRY_S
        while True:
            try:
                # ブラウザで録った声（16kHz の PCM を base64 にしたもの。30秒で1.3MB ほど）も届くので、既定の1MBより大きく受ける
                async with websockets.connect(
                    self._url, additional_headers=self._headers, ping_interval=20, max_size=16 * 1024 * 1024
                ) as ws:
                    self._ws = ws
                    retry_s = RETRY_S
                    log.info("ダッシュボードのサーバーに接続しました")
                    await ws.send(json.dumps({"type": "state", **self._snapshot()}, ensure_ascii=False))
                    for message in self._hello() if self._hello else []:
                        await ws.send(json.dumps(message, ensure_ascii=False))
                    async for raw in ws:
                        try:
                            message = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        try:
                            await self._on_command(message)
                        except Exception:
                            # 1つの操作の失敗で、エージェントごと落ちないようにする
                            log.exception("画面からの操作を処理できませんでした: %s", message.get("type") if isinstance(message, dict) else message)
            except (OSError, websockets.WebSocketException) as err:
                # 上限の間隔で失敗し続けている間は記録しない（間隔が伸びる間と、つながった後に切れたときだけ記録する）
                if retry_s < RETRY_MAX_S:
                    log.warning("サーバーとの接続が切れました（%s秒後に再接続）: %s", retry_s, err)
            finally:
                self._ws = None
            await asyncio.sleep(retry_s)
            retry_s = min(RETRY_MAX_S, retry_s * 2)

    async def publish(self) -> None:
        await self.send({"type": "state", **self._snapshot()})

    async def send(self, message: dict) -> None:
        """つながっていなければ捨てる（状態はスナップショットで再接続時に送り直すので、取りこぼしても困らない）"""
        ws = self._ws
        if ws is None:
            return
        try:
            await ws.send(json.dumps(message, ensure_ascii=False))
        except websockets.WebSocketException:
            pass


class RemotePlayer:
    """
    返答の声を、ホストのスピーカーではなく話しかけてきたブラウザで鳴らす（サーバーがそのブラウザにだけ届ける）。
    Player と同じく、1文を鳴らし終えるまで play() から戻らない。ブラウザ側の再生は待てないので、音声の長さだけ待つ
    （文の合成と再生の歩調、画面のアバターの口パクが、スピーカーで鳴らしたときと同じになる）
    """

    def __init__(self, relay: Relay, client_id: str, turn_id: str | None) -> None:
        self._relay = relay
        self._client_id = client_id
        self._turn_id = turn_id
        self._stopped = asyncio.Event()
        self._playing = False

    async def play(self, wav: bytes) -> None:
        if self._stopped.is_set():
            return
        await self._relay.send(
            {
                "type": "audio",
                "clientId": self._client_id,
                "turnId": self._turn_id,
                "wav": base64.b64encode(wav).decode("ascii"),
            }
        )
        self._playing = True
        try:
            await asyncio.wait_for(self._stopped.wait(), timeout=wav_duration_s(wav))
        except TimeoutError:
            pass
        finally:
            self._playing = False

    def stop(self) -> None:
        self._stopped.set()
        # 読み終えた後に呼ばれたとき（後始末）は、ブラウザに残っている最後の文を切らないよう知らせない
        if self._playing:
            asyncio.create_task(self._relay.send({"type": "audio-stop", "clientId": self._client_id}))
