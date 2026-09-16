import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from urllib.parse import urlencode

import websockets

log = logging.getLogger(__name__)

RETRY_S = 5


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
    ) -> None:
        ws_base = server_url.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        query = f"?{urlencode({'token': token})}" if token else ""
        self._url = f"{ws_base}/ws/voice-agent{query}"
        self._snapshot = snapshot
        self._on_command = on_command
        self._ws: websockets.ClientConnection | None = None

    async def run(self) -> None:
        while True:
            try:
                async with websockets.connect(self._url, ping_interval=20) as ws:
                    self._ws = ws
                    log.info("ダッシュボードのサーバーに接続しました")
                    await ws.send(json.dumps({"type": "state", **self._snapshot()}, ensure_ascii=False))
                    async for raw in ws:
                        try:
                            message = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        await self._on_command(message)
            except (OSError, websockets.WebSocketException) as err:
                log.warning("サーバーとの接続が切れました（%s秒後に再接続）: %s", RETRY_S, err)
            finally:
                self._ws = None
            await asyncio.sleep(RETRY_S)

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
