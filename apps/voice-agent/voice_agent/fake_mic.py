"""
マイクが無い環境で動作確認するための疑似マイク。音声ファイルを実時間のペースで 16kHz mono s16le として
標準出力に流し、間と最後は無音で埋める。VOICE_INPUT_CMD に指定して使う:

    VOICE_INPUT_CMD="python -m voice_agent.fake_mic --gap 8 wake.wav command.wav"
"""

import argparse
import subprocess
import sys
import time

from .audio import CHUNK_BYTES, SAMPLE_RATE, SAMPLE_WIDTH


def decode(path: str) -> bytes:
    return subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-"],
        check=True,
        capture_output=True,
    ).stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--lead", type=float, default=3, help="最初のファイルを流すまでの無音秒数")
    parser.add_argument("--gap", type=float, default=1, help="ファイル間の無音秒数")
    args = parser.parse_args()

    silence = lambda s: bytes(int(s * SAMPLE_RATE) * SAMPLE_WIDTH)  # noqa: E731
    stream = bytearray(silence(args.lead))
    for i, path in enumerate(args.files):
        if i:
            stream += silence(args.gap)
        stream += decode(path)

    out = sys.stdout.buffer
    started = time.monotonic()
    sent = 0
    while True:
        chunk = bytes(stream[sent : sent + CHUNK_BYTES]) if sent < len(stream) else bytes(CHUNK_BYTES)
        chunk += bytes(CHUNK_BYTES - len(chunk))
        out.write(chunk)
        out.flush()
        sent += CHUNK_BYTES
        delay = started + sent / (SAMPLE_RATE * SAMPLE_WIDTH) - time.monotonic()
        if delay > 0:
            time.sleep(delay)


if __name__ == "__main__":
    main()
