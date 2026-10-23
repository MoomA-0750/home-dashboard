import os
import shlex
from dataclasses import dataclass
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = Path.home() / ".cache" / "home-dashboard-voice"


def _load_env_file(path: Path) -> None:
    """apps/voice-agent/.env を読む。すでに環境変数で渡されている値は上書きしない（systemd等からの指定を優先）"""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def _env(key: str, default: str) -> str:
    value = os.environ.get(key, "")
    return value if value != "" else default


def _path(value: str) -> Path:
    return Path(value).expanduser()


def _words(value: str) -> list[str]:
    return [w for w in value.replace(",", " ").split() if w]


@dataclass(frozen=True)
class Config:
    server_url: str
    agent_token: str

    input_cmd: list[str]
    output_cmd: list[str]

    vosk_model_dir: Path
    wake_phrase: list[str]
    wake_decoys: list[str]
    listen_timeout_s: float
    follow_up_s: float
    end_silence_s: float
    max_utterance_s: float

    personas_dir: Path
    history_turns: int
    history_hours: float

    whisper_model: str
    whisper_compute_type: str

    claude_bin: str
    claude_model: str
    claude_tools: str
    dashboard_mcp: bool
    claude_cwd: Path
    claude_timeout_s: float
    session_idle_s: float

    voicevox_url: str
    voicevox_speaker: int
    voicevox_speed: float
    aivisspeech_url: str

    chime: bool


def load_config() -> Config:
    _load_env_file(AGENT_DIR / ".env")

    return Config(
        server_url=_env("VOICE_SERVER_URL", "http://127.0.0.1:8787").rstrip("/"),
        agent_token=_env("VOICE_AGENT_TOKEN", ""),
        # 既定はALSA既定デバイスからの 16kHz mono s16le。デバイスを選ぶなら `arecord -D plughw:1,0 ...` のように丸ごと差し替える
        input_cmd=shlex.split(_env("VOICE_INPUT_CMD", "arecord -q -t raw -f S16_LE -r 16000 -c 1")),
        # WAVを標準入力で受け取って再生するコマンド
        output_cmd=shlex.split(_env("VOICE_OUTPUT_CMD", "aplay -q -")),
        vosk_model_dir=_path(_env("VOICE_VOSK_MODEL_DIR", str(CACHE_DIR / "vosk-model-small-ja-0.22"))),
        # Voskの単語単位（語彙に無い語は無視されるので、変えたら検出できるか必ず確認する）
        wake_phrase=_words(_env("VOICE_WAKE_PHRASE", "ねえ クロード")),
        # ウェイクワードと音の似た語。文法に入れておくと「ですね、クローゼット」を「ねえ クロード」と
        # 取り違えずにこちらへ振り分けられる（誤検出対策。README参照）
        wake_decoys=_words(
            _env(
                "VOICE_WAKE_DECOYS",
                "クローゼット クローバー クロール クローン クロス 黒 モネ ですね あのね 寝る ね",
            )
        ),
        listen_timeout_s=float(_env("VOICE_LISTEN_TIMEOUT_S", "6")),
        # 返答を読み上げた後、ウェイクワード無しで続けて話しかけられる秒数（0で無効）
        follow_up_s=float(_env("VOICE_FOLLOW_UP_S", "5")),
        end_silence_s=float(_env("VOICE_END_SILENCE_S", "1.0")),
        max_utterance_s=float(_env("VOICE_MAX_UTTERANCE_S", "20")),
        # ウェイクワードごとのキャラクター。無ければ上の VOICE_WAKE_PHRASE で呼ぶ「Claude」1人だけ
        personas_dir=_path(_env("VOICE_PERSONAS_DIR", str(AGENT_DIR.parent.parent / "config" / "voice-personas"))),
        # 新しい会話を始めるとき、キャラクター全員で共有している直近のやり取りを何件・何時間前まで渡すか
        history_turns=int(_env("VOICE_HISTORY_TURNS", "20")),
        history_hours=float(_env("VOICE_HISTORY_HOURS", "24")),
        # 実測（i5-9400 の6コア・int8、VOICEVOX の声に雑音を足した10文）: base は1発話0.8秒・文字の誤り27%、
        # small は2.1秒・16%、large-v3-turbo は8秒・4%。話しかけて待てる長さで一番当たる small を既定にする
        # （CPU に AVX2 が無いと small でも5秒ほどかかるので、そのときは base にする）
        whisper_model=_env("VOICE_WHISPER_MODEL", "small"),
        whisper_compute_type=_env("VOICE_WHISPER_COMPUTE_TYPE", "int8"),
        claude_bin=_env("VOICE_CLAUDE_BIN", "claude"),
        claude_model=_env("VOICE_CLAUDE_MODEL", "sonnet"),
        # 部屋にいる誰の声でも動くので、既定ではローカルを変更できるツールを渡さない（README参照）
        claude_tools=_env("VOICE_CLAUDE_TOOLS", "WebSearch,WebFetch"),
        # ダッシュボードのサーバーの /mcp（天気・家電・音楽のツール）をClaudeに渡すか
        dashboard_mcp=_env("VOICE_DASHBOARD_MCP", "true") != "false",
        claude_cwd=_path(_env("VOICE_CLAUDE_CWD", str(Path.home() / ".local/share/home-dashboard-voice/workspace"))),
        claude_timeout_s=float(_env("VOICE_CLAUDE_TIMEOUT_S", "180")),
        # 最後のやり取りからこの秒数以内なら同じ会話の続きとして扱う
        session_idle_s=float(_env("VOICE_SESSION_IDLE_S", "300")),
        voicevox_url=_env("VOICEVOX_URL", "http://127.0.0.1:50021").rstrip("/"),
        voicevox_speaker=int(_env("VOICEVOX_SPEAKER", "3")),
        voicevox_speed=float(_env("VOICEVOX_SPEED", "1.1")),
        # persona.json で voice.engine を "aivis" にしたキャラクターの声（VOICEVOX と同じ形の API）
        aivisspeech_url=_env("AIVISSPEECH_URL", "http://127.0.0.1:10101").rstrip("/"),
        chime=_env("VOICE_CHIME", "true") != "false",
    )
