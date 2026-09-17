"""
ウェイクワードごとに呼び分けるキャラクター（ペルソナ）の設定。

config/voice-personas.json に書く（形式は config/voice-personas.example.json）。ファイルが無ければ、
環境変数（VOICE_WAKE_PHRASE など）から作った「Claude」1人だけになる（キャラクターの無い素の音声アシスタント）。
ダッシュボードのサーバー（apps/server/src/routes/voice.ts）も同じファイルを読み、表示名やアバターに使う。
"""

import json
from dataclasses import dataclass
from pathlib import Path

from .config import Config


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
            )
        )
    if not personas:
        raise SystemExit(f"キャラクターが1人もいません: {path}")
    return Personas(personas=personas, world=_read_text(base, data.get("world")))
