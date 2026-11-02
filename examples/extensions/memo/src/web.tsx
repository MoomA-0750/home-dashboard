import { useEffect, useState } from "react";
import {
  Button,
  ButtonRow,
  defineWebExtension,
  defineWidget,
  DetailFrame,
  extensionApiUrl,
  Field,
  Message,
  usePolledResource,
  WidgetCard,
  WidgetHint,
  type WidgetDetailProps,
  type WidgetProps,
} from "@home-dashboard/widget-sdk";

/**
 * 伝言メモの拡張機能の画面側（拡張機能の作り方の見本）。
 * React と widget-sdk は本体のものを使う（ビルドの道具が同梱しないようにつなぐ）。
 * 見た目は本体の部品（WidgetCard・DetailFrame・Field・Button など）で組み、中身の並べ方だけを Tailwind のクラスで書く
 * （CSS のファイルは作らない。組み立てが、ここで使ったクラスだけを dist/web.css に出す）。
 * サーバーが api.broadcast("changed") すると、WebSocket に "ext:memo:changed" が届くので、すぐ読み直す。
 */

interface MemoResponse {
  title: string;
  memo: { text: string; author: string | null; updatedAt: string | null };
}

function useMemo(ctx: WidgetProps["ctx"]) {
  const resource = usePolledResource(async () => {
    const res = await fetch(extensionApiUrl(ctx, "memo", "/memo"));
    if (!res.ok) throw new Error(`memo API error: ${res.status}`);
    return (await res.json()) as MemoResponse;
  }, 60_000);

  const { refresh } = resource;
  useEffect(() => {
    const socket = ctx.socket;
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      if (String(event.data).includes('"ext:memo:changed"')) void refresh();
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, refresh]);
  return resource;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function MemoView({ ctx, openDetail }: WidgetProps) {
  const { data } = useMemo(ctx);
  return (
    <WidgetCard className="gap-1.5 text-left" onClick={openDetail}>
      <span className="text-note text-muted">{data?.title ?? "伝言メモ"}</span>
      <span className="untrim line-clamp-3 text-title leading-normal whitespace-pre-wrap">{data?.memo.text || "まだメモはありません。押して書けます"}</span>
      {data?.memo.updatedAt && (
        <WidgetHint>
          {data.memo.author ?? "だれか"} · {formatWhen(data.memo.updatedAt)}
        </WidgetHint>
      )}
    </WidgetCard>
  );
}

function MemoDetail({ ctx, closeDetail }: WidgetDetailProps) {
  const { data } = useMemo(ctx);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = draft ?? data?.memo.text ?? "";

  const save = async () => {
    const res = await fetch(extensionApiUrl(ctx, "memo", "/memo"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? `保存できませんでした（${res.status}）`);
    closeDetail();
  };

  return (
    <DetailFrame title={data?.title ?? "伝言メモ"}>
      <Field label="伝言">
        <textarea value={text} maxLength={500} rows={6} onChange={(e) => setDraft(e.target.value)} />
      </Field>
      {error && <Message tone="error">{error}</Message>}
      <ButtonRow>
        <Button variant="primary" onClick={() => void save()}>
          保存
        </Button>
      </ButtonRow>
    </DetailFrame>
  );
}

const memoWidget = defineWidget({
  id: "memo",
  name: "伝言メモ",
  description: "家族への伝言を1つ置いておきます。音声アシスタントに「メモして」と頼むこともできます",
  defaultSize: { w: 3, h: 1 },
  defaultConfig: {},
  Component: MemoView,
  DetailComponent: MemoDetail,
});

export default defineWebExtension({ widgets: [memoWidget] });
