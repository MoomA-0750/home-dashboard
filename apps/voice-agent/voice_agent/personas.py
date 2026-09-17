"""
ウェイクワードごとに呼び分けるキャラクター（ペルソナ）の設定。

config/voice-personas/ に、キャラクター1人を1ディレクトリで置く（形式は config/voice-personas.example/）:

    common.json          全員に共通の設定（wakePrefix・commonDecoys・並び順 order）。省略可
    world.md             キャラクターたちの共通の設定（世界観・関係性）。省略可
    <id>/persona.json    名前・ウェイクワード・おとり・声・表情
    <id>/prompt.md       振る舞い・口調。無ければキャラクターの無い素のアシスタント
    <id>/avatar.vrm      VRMアバター（画面が使う。エージェントは読まない）

1人分のディレクトリをZIPにしたものを、ダッシュボードの設定画面からインポート・書き出し・削除できる
（apps/server/src/voicePersonaPackages.ts）。キャラクターが1人もいなければ、環境変数（VOICE_WAKE_PHRASE など）から作った
「Claude」1人だけになる。ダッシュボードのサーバーも同じディレクトリを読み、表示名やアバターに使う。
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

from .config import Config

log = logging.getLogger(__name__)


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
    # 画面に出す呼び名（ウェイクワードが表示名と違う読みのとき）。書き起こしからウェイクワードを落とすのにも使う
    wake_label: str | None = None


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
        names = [p.name for p in self.personas] + [p.wake_label for p in self.personas if p.wake_label]
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


PERSONA_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
DEFAULT_COMMON_DECOYS = ["ですね", "あのね", "寝る", "ね"]


def _read_optional(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


def _fallback(config: Config) -> Personas:
    persona = Persona(
        id="claude",
        name="Claude",
        wake_phrases=[config.wake_phrase],
        decoys=config.wake_decoys,
        prompt="",
        speaker=config.voicevox_speaker,
        speed=config.voicevox_speed,
    )
    return Personas(personas=[persona], world="")


def persona_dirs(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return [d for d in root.iterdir() if d.is_dir() and PERSONA_ID.match(d.name) and (d / "persona.json").is_file()]


def load_personas(config: Config) -> Personas:
    root = config.personas_dir
    dirs = persona_dirs(root)
    if not dirs:
        return _fallback(config)

    common_path = root / "common.json"
    common = json.loads(common_path.read_text(encoding="utf-8")) if common_path.exists() else {}
    prefix = _words(common.get("wakePrefix", "ねえ"))
    # 名前によらず「ね」で終わる語など、誰を呼ぶ場合にも紛らわしい語
    common_decoys = common.get("commonDecoys", DEFAULT_COMMON_DECOYS)
    order = {persona_id: i for i, persona_id in enumerate(common.get("order", []))}
    dirs.sort(key=lambda d: (order.get(d.name, len(order)), d.name))

    personas = []
    for directory in dirs:
        try:
            entry = json.loads((directory / "persona.json").read_text(encoding="utf-8"))
            voice = entry.get("voice", {})
            prompt = _read_optional(directory / "prompt.md")
            personas.append(
                Persona(
                    # ディレクトリ名を正とする（persona.json の id と食い違っていても、画面・記録と揃う方を使う）
                    id=directory.name,
                    name=entry["name"],
                    wake_phrases=[prefix + _words(word) for word in entry["wakeWords"]],
                    decoys=common_decoys + entry.get("decoys", []),
                    prompt=prompt,
                    speaker=int(voice.get("speaker", config.voicevox_speaker)),
                    speed=float(voice.get("speed", config.voicevox_speed)),
                    expressions=_expressions(entry) if prompt else {},
                    wake_label=entry.get("wakeLabel"),
                )
            )
        except (OSError, ValueError, KeyError, TypeError) as err:
            # 1人の設定が壊れていても、ほかのキャラクターは呼べるようにする
            log.error("キャラクターの設定を読めませんでした（%s）: %s", directory, err)
    if not personas:
        return _fallback(config)
    return Personas(personas=personas, world=_read_optional(root / "world.md"))


def personas_signature(config: Config) -> tuple:
    """設定ファイルの更新を検知するための値（アバターはエージェントが使わないので見ない）"""
    root = config.personas_dir
    files = [root / "common.json", root / "world.md"]
    for directory in persona_dirs(root):
        files += [directory / "persona.json", directory / "prompt.md"]
    signature = []
    for path in files:
        try:
            stat = path.stat()
            signature.append((str(path), stat.st_mtime_ns, stat.st_size))
        except FileNotFoundError:
            continue
    return tuple(sorted(signature))


def check_personas(personas: Personas, vocabulary: set[str] | None, speakers: set[int] | None) -> dict[str, list[str]]:
    """
    インポートしたキャラクターが実際に呼べるかを確かめる。Vosk の文法は語彙に無い語を黙って捨てるので、
    ウェイクワードが語彙に無いと、いくら呼んでも反応しない。
    """
    warnings: dict[str, list[str]] = {}
    for persona in personas.personas:
        found: list[str] = []
        if vocabulary is not None:
            for phrase in persona.wake_phrases:
                missing = [word for word in phrase if word not in vocabulary]
                if missing:
                    found.append(
                        f"ウェイクワード「{''.join(phrase)}」の「{'・'.join(missing)}」が音声認識の語彙に無いため、呼んでも反応しません"
                    )
            missing_decoys = [word for word in persona.decoys if word not in vocabulary]
            if missing_decoys:
                found.append(f"おとり単語「{'・'.join(missing_decoys)}」が語彙に無いため、効いていません")
        if speakers is not None:
            voice_ids = {persona.speaker} | {e.speaker for e in persona.expressions.values() if e.speaker is not None}
            for speaker in sorted(voice_ids - speakers):
                found.append(f"VOICEVOX に話者ID {speaker} がありません")
        if found:
            warnings[persona.id] = found
    return warnings


def load_vocabulary(vosk_model_dir: Path) -> set[str] | None:
    words = vosk_model_dir / "graph" / "words.txt"
    if not words.exists():
        return None
    with words.open(encoding="utf-8") as f:
        return {line.split(" ", 1)[0] for line in f}
