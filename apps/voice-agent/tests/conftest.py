"""
テスト用の音声は VOICEVOX Engine で都度作り、~/.cache/home-dashboard-voice/test-audio に置いておく。
リポジトリに音声ファイルを入れないのは、VOICEVOX の音声の配布にはキャラクターごとの規約（クレジット表記など）が
かかるため。VOICEVOX Engine・Vosk のモデルが無い環境では、それらを使うテストはスキップする。
"""

import hashlib
import subprocess

import httpx
import pytest

from voice_agent.config import CACHE_DIR, load_config

AUDIO_CACHE = CACHE_DIR / "test-audio"
VOICEVOX_URL = load_config().voicevox_url

# 声の違いで判定が揺れないか見るため、話者を混ぜる（2: 四国めたん / 3: ずんだもん / 8: 春日部つむぎ / 11: 玄野武宏）
SPEAKERS = (2, 3, 8, 11)


def _voicevox_available() -> bool:
    try:
        return httpx.get(f"{VOICEVOX_URL}/version", timeout=2).is_success
    except httpx.HTTPError:
        return False


@pytest.fixture(scope="session")
def speech_pcm():
    """テキストを 16kHz mono s16le の音声にする関数を返す"""
    if not _voicevox_available():
        pytest.skip(f"VOICEVOX Engine に接続できません（{VOICEVOX_URL}）")
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)

    def synthesize(text: str, speaker: int = 3) -> bytes:
        key = hashlib.sha1(f"{speaker}:{text}".encode()).hexdigest()[:16]
        path = AUDIO_CACHE / f"{key}.pcm"
        if not path.exists():
            query = httpx.post(f"{VOICEVOX_URL}/audio_query", params={"text": text, "speaker": speaker}, timeout=60)
            wav = httpx.post(
                f"{VOICEVOX_URL}/synthesis", params={"speaker": speaker}, json=query.json(), timeout=120
            ).content
            pcm = subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-i", "-", "-f", "s16le", "-ar", "16000", "-ac", "1", "-"],
                input=wav,
                capture_output=True,
                check=True,
            ).stdout
            path.write_bytes(pcm)
        return path.read_bytes()

    return synthesize


@pytest.fixture(scope="session")
def vosk_model():
    config = load_config()
    if not config.vosk_model_dir.exists():
        pytest.skip(f"Voskのモデルがありません: {config.vosk_model_dir}")
    from vosk import Model

    return Model(str(config.vosk_model_dir))


@pytest.fixture(scope="session")
def transcriber():
    from voice_agent.stt import Transcriber

    config = load_config()
    return Transcriber(config.whisper_model, config.whisper_compute_type)
