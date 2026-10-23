"""VOICEVOX Engine・AivisSpeech Engine と実際につないで、口パクの時系列が合成した音声と揃うかを確かめる"""

import asyncio
import io
import wave

import pytest

from voice_agent.config import load_config
from voice_agent.speech import Voice, VoiceVox

pytestmark = pytest.mark.audio


@pytest.mark.parametrize("text", ["はい。", "今日の東京は雨模様で、雷を伴うところもあるみたいです。"])
def test_mouth_cues_match_synthesized_audio(speech_pcm, text):
    # speech_pcm は VOICEVOX Engine が無ければスキップさせるために使う
    config = load_config()
    voice = Voice(config.voicevox_speaker, config.voicevox_speed)
    speech = asyncio.run(VoiceVox(config.voicevox_url).synthesize(text, voice))
    with wave.open(io.BytesIO(speech.wav)) as w:
        actual = w.getnframes() / w.getframerate()
    # アバターの口が声とずれて見えない程度（実測で20ms前後）に揃っていること
    assert abs(speech.duration_s - actual) < 0.05
    times = [t for t, _ in speech.mouth_cues]
    assert times == sorted(times)
    assert times[-1] <= speech.duration_s
    assert {v for _, v in speech.mouth_cues} & {"a", "i", "u", "e", "o"}


def test_aivisspeech_mouth_cues_span_synthesized_audio():
    config = load_config()

    async def synthesize():
        engine = VoiceVox(config.aivisspeech_url, estimate_timing=True)
        speakers = await engine.speaker_ids()
        if not speakers:
            return None
        return await engine.synthesize("おはよう、今日はいい天気だね。", Voice(min(speakers), 1.1, "aivis"))

    speech = asyncio.run(synthesize())
    if speech is None:
        pytest.skip(f"AivisSpeech Engine に接続できません（{config.aivisspeech_url}）")
    with wave.open(io.BytesIO(speech.wav)) as w:
        actual = w.getnframes() / w.getframerate()
    assert abs(speech.duration_s - actual) < 0.01
    vowels = [v for _, v in speech.mouth_cues]
    assert "pau" in vowels[1:-1] and {"a", "i", "o"} <= set(vowels)
    assert speech.beats
