"""VOICEVOX Engine と実際につないで、口パクの時系列が合成した音声と揃うかを確かめる"""

import asyncio
import io
import wave

import pytest

from voice_agent.config import load_config
from voice_agent.speech import VoiceVox

pytestmark = pytest.mark.audio


@pytest.mark.parametrize("text", ["はい。", "今日の東京は雨模様で、雷を伴うところもあるみたいです。"])
def test_mouth_cues_match_synthesized_audio(speech_pcm, text):
    # speech_pcm は VOICEVOX Engine が無ければスキップさせるために使う
    config = load_config()
    speech = asyncio.run(VoiceVox(config.voicevox_url, config.voicevox_speaker, config.voicevox_speed).synthesize(text))
    with wave.open(io.BytesIO(speech.wav)) as w:
        actual = w.getnframes() / w.getframerate()
    # アバターの口が声とずれて見えない程度（実測で20ms前後）に揃っていること
    assert abs(speech.duration_s - actual) < 0.05
    times = [t for t, _ in speech.mouth_cues]
    assert times == sorted(times)
    assert times[-1] <= speech.duration_s
    assert {v for _, v in speech.mouth_cues} & {"a", "i", "u", "e", "o"}
