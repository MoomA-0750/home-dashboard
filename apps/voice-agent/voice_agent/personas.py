"""
ウェイクワードごとに呼び分けるキャラクター（ペルソナ）の設定。

config/voice-personas.json に書く（形式は config/voice-personas.example.json）。ファイルが無ければ、
環境変数（VOICE_WAKE_PHRASE など）から作った「Claude」1人だけになる（キャラクターの無い素の音声アシスタント）。
ダッシュボードのサーバー（apps/server/src/routes/voice.ts）も同じファイルを読み、表示名やアバターに使う。
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from .config import Config


@dataclass(frozen=True)
class Expression:
    """
    返答の中の（表情名）で切り替える表情と声のトーン。
    avatar は VRM の表情名と重み（例: {"happy": 0.6}）、speaker/speed は VOICEVOX のスタイルID・話速（省略時はキャラクターの声のまま）。
    keywords は、Claude が一覧に無い言葉（「（嬉しそうに笑う）」）を書いてしまったときに、どの表情とみなすかの手がかり
    """

    name: str
    avatar: dict[str, float]
    speaker: int | None = None
    speed: float | None = None
    keywords: tuple[str, ...] = ()


# キャラクターに設定が無くても使える表情。VRM の標準の表情（0.x の joy/fun/sorrow は three-vrm が happy/relaxed/sad に読み替える）
DEFAULT_EXPRESSIONS = [
    Expression("ふつう", {}),
    Expression("にっこり", {"happy": 0.6}, keywords=("笑", "にこ", "嬉", "喜", "楽し")),
    Expression("びっくり", {"surprised": 0.8}, keywords=("驚", "びっくり", "目を丸")),
    Expression("しょんぼり", {"sad": 0.7}, keywords=("しょんぼり", "悲し", "落ち込", "泣", "寂し")),
    Expression("ぷんぷん", {"angry": 0.7}, keywords=("怒", "むっ", "ぷん", "むく")),
    Expression("ほっこり", {"relaxed": 0.6}, keywords=("ほっ", "安心", "穏やか", "のんびり")),
]


@dataclass(frozen=True)
class Persona:
    id: str
    name: str
    # Vosk の単語単位のウェイクワード（例: [["ねえ", "プラム"]]）
    wake_phrases: list[list[str]]
    # このキャラクターの名前と音の似た語（誤検出を吸わせるおとり）
    decoys: list[str]
    # 振る舞い・口調などの設定。空ならキャラクター無し
    prompt: str
    speaker: int
    speed: float
    # （表情名）で切り替えられる表情。キャラクター設定が無い素のアシスタントでは空
    expressions: dict[str, Expression] = field(default_factory=dict)


@dataclass(frozen=True)
class Personas:
    personas: list[Persona]
    # キャラクターたちの共通の設定（世界観・関係性など）
    world: str

    def get(self, persona_id: str | None) -> Persona:
        for persona in self.personas:
            if persona.id == persona_id:
                return persona
        return self.personas[0]

    @property
    def decoys(self) -> list[str]:
        seen: dict[str, None] = {}
        for persona in self.personas:
            seen.update(dict.fromkeys(persona.decoys))
        return list(seen)

    @property
    def names(self) -> list[str]:
        """書き起こしからウェイクワードを落とすときに使う名前（表示名と、Vosk 用の表記の両方）"""
        names = [p.name for p in self.personas]
        names += ["".join(phrase[1:]) for p in self.personas for phrase in p.wake_phrases if len(phrase) > 1]
        return list(dict.fromkeys(names))

    @property
    def has_characters(self) -> bool:
        return any(p.prompt for p in self.personas)


def _words(value: str) -> list[str]:
    return [w for w in value.replace(",", " ").split() if w]


def _expressions(entry: dict) -> dict[str, Expression]:
    expressions = {e.name: e for e in DEFAULT_EXPRESSIONS}
    for name, spec in entry.get("expressions", {}).items():
        voice = spec.get("voice", {})
        expressions[name] = Expression(
            name=name,
            avatar={k: float(v) for k, v in spec.get("avatar", {}).items()},
            speaker=voice.get("speaker"),
            speed=voice.get("speed"),
            keywords=tuple(spec.get("keywords", [])),
        )
    return expressions


def _read_text(base: Path, relative: str | None) -> str:
    return (base / relative).read_text(encoding="utf-8").strip() if relative else ""


def load_personas(config: Config) -> Personas:
    path = config.personas_path
    if not path.exists():
        return Personas(
            personas=[
                Persona(
                    id="claude",
                    name="Claude",
                    wake_phrases=[config.wake_phrase],
                    decoys=config.wake_decoys,
                    prompt="",
                    speaker=config.voicevox_speaker,
                    speed=config.voicevox_speed,
                )
            ],
            world="",
        )

    data = json.loads(path.read_text(encoding="utf-8"))
    base = path.parent
    prefix = _words(data.get("wakePrefix", "ねえ"))
    # 名前によらず「ね」で終わる語など、誰を呼ぶ場合にも紛らわしい語
    common_decoys = data.get("commonDecoys", ["ですね", "あのね", "寝る", "ね"])
    personas = []
    for entry in data["personas"]:
        voice = entry.get("voice", {})
        personas.append(
            Persona(
                id=entry["id"],
                name=entry["name"],
                wake_phrases=[prefix + _words(word) for word in entry["wakeWords"]],
                decoys=common_decoys + entry.get("decoys", []),
                prompt=_read_text(base, entry.get("prompt")),
                speaker=int(voice.get("speaker", config.voicevox_speaker)),
                speed=float(voice.get("speed", config.voicevox_speed)),
                expressions=_expressions(entry) if entry.get("prompt") else {},
            )
        )
    if not personas:
        raise SystemExit(f"キャラクターが1人もいません: {path}")
    return Personas(personas=personas, world=_read_text(base, data.get("world")))
