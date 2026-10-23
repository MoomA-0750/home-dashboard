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
    avatar は VRM の表情名と重み（例: {"happy": 0.6}）、speaker/speed/engine は合成エンジンのスタイルID・話速・エンジン（省略時はキャラクターの声のまま）。
    keywords は、Claude が一覧に無い言葉（「（嬉しそうに笑う）」）を書いてしまったときに、どの表情とみなすかの手がかり
    """

    name: str
    avatar: dict[str, float]
    speaker: int | None = None
    speed: float | None = None
    engine: str | None = None
    keywords: tuple[str, ...] = ()
    # 体の身振りの名前（画面の apps/web/src/avatar/motions.ts）。省略時は avatar の表情から推測する
    motion: str | None = None


# 身振りを指定していない表情は、いちばん強く動かす標準の表情から身振りを選ぶ
_MOTION_BY_PRESET = {"happy": "happy", "surprised": "surprised", "sad": "sad", "angry": "angry", "relaxed": "relaxed"}


def infer_motion(avatar: dict[str, float]) -> str | None:
    presets = [(weight, _MOTION_BY_PRESET[name.lower()]) for name, weight in avatar.items() if name.lower() in _MOTION_BY_PRESET]
    return max(presets)[1] if presets else None


# キャラクターに設定が無くても使える表情。VRM の標準の表情（0.x の joy/fun/sorrow は three-vrm が happy/relaxed/sad に読み替える）
DEFAULT_EXPRESSIONS = [
    Expression("ふつう", {}),
    Expression("にっこり", {"happy": 0.6}, keywords=("笑", "にこ", "嬉", "喜", "楽し"), motion="happy"),
    Expression("びっくり", {"surprised": 0.8}, keywords=("驚", "びっくり", "目を丸"), motion="surprised"),
    Expression("しょんぼり", {"sad": 0.7}, keywords=("しょんぼり", "悲し", "落ち込", "泣", "寂し"), motion="sad"),
    Expression("ぷんぷん", {"angry": 0.7}, keywords=("怒", "むっ", "ぷん", "むく"), motion="angry"),
    Expression("ほっこり", {"relaxed": 0.6}, keywords=("ほっ", "安心", "穏やか", "のんびり"), motion="relaxed"),
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
    # 声の合成エンジン（voicevox / aivis。speech.ENGINES）
    engine: str = "voicevox"


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

    def mentioned(self, text: str) -> Persona | None:
        """
        文字で話しかけたときの「@カリン」（全角の＠も）。いちばん前にある呼びかけのキャラクターを返す。
        表示名・呼び名・ウェイクワードの表記（「花梨」）・ID のどれで書いてもよい
        """
        found: tuple[int, int, Persona] | None = None
        for persona in self.personas:
            aliases = {persona.name, persona.id, persona.wake_label or ""}
            aliases |= {"".join(phrase[1:]) for phrase in persona.wake_phrases if len(phrase) > 1}
            for alias in filter(None, aliases):
                for match in re.finditer(r"[@＠]\s*" + re.escape(alias), text, re.IGNORECASE):
                    # 同じ位置なら長い名前を優先する（「カリン」と「カリンちゃん」が別人のときなど）
                    key = (match.start(), -len(alias))
                    if found is None or key < found[:2]:
                        found = (*key, persona)
        return found[2] if found else None


def _words(value: str) -> list[str]:
    return [w for w in value.replace(",", " ").split() if w]


def _expressions(entry: dict) -> dict[str, Expression]:
    expressions = {e.name: e for e in DEFAULT_EXPRESSIONS}
    for name, spec in entry.get("expressions", {}).items():
        voice = spec.get("voice", {})
        avatar = {k: float(v) for k, v in spec.get("avatar", {}).items()}
        expressions[name] = Expression(
            name=name,
            avatar=avatar,
            speaker=voice.get("speaker"),
            speed=voice.get("speed"),
            engine=_engine(voice.get("engine")) if voice.get("engine") else None,
            keywords=tuple(spec.get("keywords", [])),
            motion=spec.get("motion") or infer_motion(avatar),
        )
    return expressions


ENGINE_NAMES = {"voicevox": "VOICEVOX", "aivis": "AivisSpeech"}


def _engine(value: object) -> str:
    if value not in ENGINE_NAMES:
        raise ValueError(f"voice.engine は {' / '.join(ENGINE_NAMES)} のどれかにしてください: {value}")
    return str(value)


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
    try:
        common = json.loads(common_path.read_text(encoding="utf-8")) if common_path.exists() else {}
    except (OSError, ValueError) as err:
        # 書きかけ・手で壊したときに、エージェントごと落ちて再起動を繰り返さないよう、共通の設定なしで読む
        log.warning("common.json を読めませんでした（共通の設定なしで読みます）: %s", err)
        common = {}
    if not isinstance(common, dict):
        common = {}
    prefix = _words(common.get("wakePrefix", "ねえ"))
    # 名前によらず「ね」で終わる語など、誰を呼ぶ場合にも紛らわしい語
    common_decoys = common.get("commonDecoys", DEFAULT_COMMON_DECOYS)
    order = {persona_id: i for i, persona_id in enumerate(common.get("order", []))}
    dirs.sort(key=lambda d: (order.get(d.name, len(order)), d.name))
    # 設定画面で切ったキャラクターは読み込まない（ウェイクワードに反応しない）。全員を切ってあるときは全員を読む
    disabled = set(common.get("disabled", []))
    if any(d.name not in disabled for d in dirs):
        dirs = [d for d in dirs if d.name not in disabled]

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
                    engine=_engine(voice.get("engine", "voicevox")),
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


def check_personas(
    personas: Personas, vocabulary: set[str] | None, speakers: dict[str, set[int] | None]
) -> dict[str, list[str]]:
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
        # speakers はエンジンごとの話者ID。つながらなかったエンジン（None）は確かめない
        voices = {(persona.engine, persona.speaker)} | {
            (e.engine or persona.engine, e.speaker) for e in persona.expressions.values() if e.speaker is not None
        }
        for engine, speaker in sorted(voices):
            known = speakers.get(engine)
            if known is not None and speaker not in known:
                found.append(f"{ENGINE_NAMES[engine]} に話者ID {speaker} がありません")
        if found:
            warnings[persona.id] = found
    return warnings


def load_vocabulary(vosk_model_dir: Path) -> set[str] | None:
    words = vosk_model_dir / "graph" / "words.txt"
    if not words.exists():
        return None
    with words.open(encoding="utf-8") as f:
        return {line.split(" ", 1)[0] for line in f}
