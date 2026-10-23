"""キャラクター設定（config/voice-personas/ の1人1ディレクトリ）の読み込みと、呼べるかどうかの確認"""

import dataclasses
import json
from pathlib import Path

from voice_agent.config import load_config
from voice_agent.personas import check_personas, load_personas, personas_signature


def write_persona(root: Path, persona_id: str, *, prompt: str | None = None, **overrides) -> Path:
    directory = root / persona_id
    directory.mkdir(parents=True, exist_ok=True)
    meta = {"id": persona_id, "name": persona_id.upper(), "wakeWords": ["プラム"], "voice": {"speaker": 70}} | overrides
    (directory / "persona.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    if prompt is not None:
        (directory / "prompt.md").write_text(prompt, encoding="utf-8")
    return directory


def config_for(root: Path):
    return dataclasses.replace(load_config(), personas_dir=root)


def test_skips_disabled_personas(tmp_path):
    # 設定画面で切ったキャラクターは読み込まない（ウェイクワードに反応しない）
    (tmp_path / "common.json").write_text(json.dumps({"disabled": ["b"]}), encoding="utf-8")
    write_persona(tmp_path, "a")
    write_persona(tmp_path, "b")
    assert [p.id for p in load_personas(config_for(tmp_path)).personas] == ["a"]

    # 全員を切ってあるときは、誰も呼べなくならないよう全員を読む
    (tmp_path / "common.json").write_text(json.dumps({"disabled": ["a", "b"]}), encoding="utf-8")
    assert [p.id for p in load_personas(config_for(tmp_path)).personas] == ["a", "b"]


def test_falls_back_to_plain_claude_without_personas(tmp_path):
    personas = load_personas(config_for(tmp_path / "missing"))
    assert [p.id for p in personas.personas] == ["claude"]
    assert not personas.has_characters


def test_loads_personas_in_common_order(tmp_path):
    (tmp_path / "common.json").write_text(json.dumps({"wakePrefix": "ねえ", "order": ["b", "a"]}), encoding="utf-8")
    (tmp_path / "world.md").write_text("姉妹で暮らしている", encoding="utf-8")
    write_persona(tmp_path, "a", prompt="Aの設定", expressions={"ドヤ顔": {"avatar": {"doya_1": 1}, "voice": {"speaker": 71}}})
    write_persona(tmp_path, "b", name="ビー", wakeWords=["甘夏"])
    write_persona(tmp_path, "c", prompt="並び順に無いものは最後")
    # ディレクトリ名がIDとして使えないもの（インポート途中の一時ディレクトリなど）は読まない
    write_persona(tmp_path, ".import-123")

    personas = load_personas(config_for(tmp_path))
    assert [p.id for p in personas.personas] == ["b", "a", "c"]
    assert personas.world == "姉妹で暮らしている"
    a = personas.get("a")
    assert a.wake_phrases == [["ねえ", "プラム"]]
    # プロンプトのあるキャラクターは、共通の表情に自分の表情を足したものを使える
    assert "にっこり" in a.expressions and a.expressions["ドヤ顔"].speaker == 71
    # プロンプトの無いキャラクター（素のアシスタント）は表情を使わない
    assert personas.get("b").expressions == {}


def test_broken_persona_does_not_hide_others(tmp_path):
    write_persona(tmp_path, "good", prompt="ok")
    broken = tmp_path / "broken"
    broken.mkdir()
    (broken / "persona.json").write_text("{not json", encoding="utf-8")
    assert [p.id for p in load_personas(config_for(tmp_path)).personas] == ["good"]


def test_signature_changes_when_files_change(tmp_path):
    config = config_for(tmp_path)
    write_persona(tmp_path, "a", prompt="1")
    before = personas_signature(config)
    (tmp_path / "a" / "prompt.md").write_text("22", encoding="utf-8")
    assert personas_signature(config) != before
    write_persona(tmp_path, "b")
    assert len(personas_signature(config)) == 3


def test_check_personas_reports_unreachable_wake_words_and_voices(tmp_path):
    write_persona(tmp_path, "a", prompt="p", wakeWords=["プラム", "ぷらむ"], decoys=["プラモ", "ぷらも"])
    personas = load_personas(config_for(tmp_path))
    vocabulary = {"ねえ", "プラム", "プラモ", "ですね", "あのね", "寝る", "ね"}
    warnings = check_personas(personas, vocabulary, speakers={"voicevox": {69, 70}})
    assert warnings == {
        "a": [
            "ウェイクワード「ねえぷらむ」の「ぷらむ」が音声認識の語彙に無いため、呼んでも反応しません",
            "おとり単語「ぷらも」が語彙に無いため、効いていません",
        ]
    }
    assert check_personas(personas, None, {"voicevox": {1}}) == {"a": ["VOICEVOX に話者ID 70 がありません"]}
    # つながらなかったエンジンの話者は確かめない
    assert check_personas(personas, None, {"voicevox": None}) == {}


def test_voice_engine_per_persona_and_expression(tmp_path):
    """voice.engine で合成エンジンを選び、表情の声は書かなければキャラクターのエンジンを使う"""
    write_persona(
        tmp_path,
        "a",
        prompt="p",
        voice={"speaker": 888753760, "engine": "aivis"},
        expressions={"ささやき": {"avatar": {"relaxed": 1}, "voice": {"speaker": 888753763}}},
    )
    write_persona(tmp_path, "b", prompt="p", voice={"speaker": 70, "engine": "mystery"})
    personas = load_personas(config_for(tmp_path))
    # 知らないエンジンを書いたキャラクターは読まない（ほかのキャラクターは呼べる）
    assert [p.id for p in personas.personas] == ["a"]
    a = personas.get("a")
    assert a.engine == "aivis" and a.expressions["ささやき"].engine is None
    warnings = check_personas(personas, None, {"voicevox": {70}, "aivis": {888753760}})
    assert warnings == {"a": ["AivisSpeech に話者ID 888753763 がありません"]}


def test_expression_motion_is_explicit_or_inferred(tmp_path):
    """表情の身振りは persona.json の motion を使い、無ければいちばん強い標準の表情から推測する"""
    write_persona(
        tmp_path,
        "a",
        prompt="p",
        expressions={
            "ドヤ顔": {"avatar": {"doya_1": 1.0}, "motion": "proud"},
            "てれ": {"avatar": {"happy": 0.3, "sad": 0.5}},
            "無表情": {"avatar": {"custom": 1.0}},
        },
    )
    expressions = load_personas(config_for(tmp_path)).get("a").expressions
    assert expressions["ドヤ顔"].motion == "proud"
    assert expressions["てれ"].motion == "sad"
    assert expressions["無表情"].motion is None
    assert expressions["にっこり"].motion == "happy"


def test_mention_picks_the_called_character(tmp_path):
    """文字で「@カリン」と書いたら、そのキャラクターが答える（全角の＠・ウェイクワードの表記・IDでも）"""
    write_persona(tmp_path, "plum", prompt="p", name="プラム", wakeWords=["プラム"])
    write_persona(tmp_path, "karin", prompt="p", name="カリン", wakeWords=["カリン", "花梨"])
    personas = load_personas(config_for(tmp_path))
    assert personas.mentioned("@カリン 今日の予定は？").id == "karin"
    assert personas.mentioned("ねえ＠花梨、どう思う？").id == "karin"
    assert personas.mentioned("@Karin help").id == "karin"
    # いちばん前の呼びかけを使う
    assert personas.mentioned("@プラム と @カリン はどっちが好き？").id == "plum"
    assert personas.mentioned("カリンにも聞いて") is None
    assert personas.mentioned("メールは a@example.com") is None
