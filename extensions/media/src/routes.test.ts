import { test } from "node:test";
import assert from "node:assert/strict";
import { skipToQueueItem } from "./routes";
import type { MusicAction, MusicProvider } from "./types";

function fakeProvider(withSkipTo = false) {
  const calls: string[] = [];
  const provider = {
    control: async (action: MusicAction) => {
      calls.push(action);
    },
    ...(withSkipTo ? { skipTo: async (index: number, uri: string) => void calls.push(`skipTo:${index}:${uri}`) } : {}),
  } as unknown as MusicProvider;
  return { provider, calls };
}

test("飛ぶための口が無い提供元では、「次の曲」を index+1 回送る", async () => {
  const { provider, calls } = fakeProvider();
  await skipToQueueItem(provider, 0, "a", 0);
  assert.deepEqual(calls, ["next"]);
  calls.length = 0;
  await skipToQueueItem(provider, 3, "d", 0);
  assert.deepEqual(calls, ["next", "next", "next", "next"]);
});

test("飛ぶための口がある提供元では、それを1回だけ使う", async () => {
  const { provider, calls } = fakeProvider(true);
  await skipToQueueItem(provider, 2, "c", 0);
  assert.deepEqual(calls, ["skipTo:2:c"]);
});

test("範囲の外の位置は受け付けない", async () => {
  const { provider, calls } = fakeProvider();
  await assert.rejects(skipToQueueItem(provider, -1, "x", 0), /invalid index/);
  await assert.rejects(skipToQueueItem(provider, 20, "x", 0), /invalid index/);
  await assert.rejects(skipToQueueItem(provider, 1.5, "x", 0), /invalid index/);
  assert.deepEqual(calls, []);
});
