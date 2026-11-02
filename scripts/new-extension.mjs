#!/usr/bin/env node
/**
 * 拡張機能のひな形を作る道具。
 *
 *   pnpm new:extension <id> [--name 名前] [--widget] [--screen] [--server] [--states] [--provides <口の id>] [--dir <置き場>]
 *
 * - 何も選ばなければ、ウィジェットとサーバー側を作る
 * - --provides music などで、ほかの拡張機能の機能の口へ入るものを作る（Media の音楽アプリなど。口の形は口を持つ拡張機能の型を見る）
 * - --states で、本体が読める「家の状態」の値（照度・オンオフなど。夜の表示の条件に使える）を差し出すものを作る
 * - 置き場の既定は extensions/<id>（本体の拡張機能）。外で作るなら --dir で別の場所にする
 * できたら pnpm install のあと、pnpm build:extension <置き場> [--zip] で組み立てる（docs/extensions.md）
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const flag = (name) => args.includes(name);

const id = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.match(/^--(name|provides|dir)$/));
if (!id || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) {
  console.error(
    "使い方: pnpm new:extension <id> [--name 名前] [--widget] [--screen] [--server] [--states] [--provides <口の id>] [--dir <置き場>]\n" +
      "id は小文字の英数字と - で40文字まで",
  );
  process.exit(1);
}
const name = option("--name") ?? id;
const provides = option("--provides");
const chosen = flag("--widget") || flag("--screen") || flag("--server");
const withWidget = flag("--widget") || (!chosen && !provides);
const withScreen = flag("--screen");
const withStates = flag("--states");
const withServer = flag("--server") || !chosen || Boolean(provides) || withStates;
const dir = resolve(option("--dir") ?? join(ROOT, "extensions", id));
if (existsSync(dir)) {
  console.error(`${relative(process.cwd(), dir)} はもうあります`);
  process.exit(1);
}

// 名前（コンポーネント・変数）に使う形。my-thing → MyThing
const pascal = id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
const files = new Map();

files.set(
  "manifest.json",
  JSON.stringify(
    {
      id,
      name,
      version: "0.1.0",
      description: `${name}（説明を書く）`,
      apiVersion: 1,
      ...(provides ? { provides: [provides] } : {}),
      settings: withServer
        ? [{ key: "url", label: "URL", kind: "url", placeholder: "http://192.168.1.10:8080" }]
        : undefined,
    },
    null,
    2,
  ) + "\n",
);

const inRepo = !relative(ROOT, dir).startsWith("..");
files.set(
  "package.json",
  JSON.stringify(
    {
      name: `@home-dashboard/ext-${id}`,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: { typecheck: "tsc --noEmit" },
      dependencies: inRepo
        ? { "@home-dashboard/extension-sdk": "workspace:*", "@home-dashboard/widget-sdk": "workspace:*" }
        : {},
      peerDependencies: { react: "^18.3.0" },
      devDependencies: {
        "@types/node": "^22.10.10",
        "@types/react": "^18.3.18",
        typescript: "^5.7.3",
        zod: "^4.6.5",
      },
    },
    null,
    2,
  ) + "\n",
);

files.set(
  "tsconfig.json",
  JSON.stringify(
    {
      ...(inRepo ? { extends: relative(dir, join(ROOT, "tsconfig.base.json")).split("\\").join("/") } : {}),
      compilerOptions: { jsx: "react-jsx", noEmit: true, types: ["node"], strict: true, moduleResolution: "bundler" },
      include: ["src"],
    },
    null,
    2,
  ) + "\n",
);

if (withServer) {
  files.set(
    "src/server.ts",
    `import { defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";

/**
 * ${name}の拡張機能のサーバー側。
 * - GET /status … ウィジェット・画面が読む（/api/ext/${id}/status）
 */

export default defineServerExtension({
  register(api) {
    api.route("GET", "/status", async () => {
      const url = String(api.settings.url ?? "");
      if (!url) return { configured: false, message: null };
      // ここで外のサービスを読む。失敗の理由を画面に出すなら HttpError（状態コードと理由）を投げる
      if (!url.startsWith("http")) throw new HttpError(400, "URL は http から始めてください");
      return { configured: true, message: \`\${url} を見ています\` };
    });
${
  provides
    ? `
    // 機能の口「${provides}」に入る。渡すものの形は、口を持つ拡張機能が決めている（例: Media の music なら
    // @home-dashboard/ext-media/types の MusicProvider）。manifest.json の provides と web.tsx の provides にも同じ id を書く
    api.provide("${provides}", {
      // 口を持つ拡張機能の決めた形を満たす
    });
`
    : ""
}
${
  withStates
    ? `
    // 本体が読める「家の状態」の値（docs/extensions.md の「家の状態の値」）。家の人は設定の「夜の表示」で、
    // この値を条件に選べる。kind は "number"（未満・より上で比べる）か "onoff"。読めないときは value: null
    const readings = async () => [
      { id: "example", name: "${name}の値", kind: "number" as const, value: null, unit: null },
    ];
    api.provideStates({
      list: readings,
      read: async (ids) => (await readings()).filter((reading) => ids.includes(reading.id)),
    });
`
    : ""
}
    // 音声アシスタント（Claude）に渡すツール。要らなければ消す
    api.tool({
      name: "${id.replace(/-/g, "_")}_status",
      description: "${name}の今の様子を返す。",
      readOnly: true,
      handler: async () => ({ url: api.settings.url ?? null }),
    });
  },
});
`,
  );
}

const webImports = new Set(["defineWebExtension"]);
const webParts = [];
const webEntries = [];

if (withWidget) {
  files.set(
    "src/widget.tsx",
    `import {
  defineWidget,
  DetailFrame,
  extensionApiUrl,
  Note,
  usePolling,
  WidgetCard,
  WidgetHint,
  type WidgetDetailProps,
  type WidgetProps,
} from "@home-dashboard/widget-sdk";

/**
 * ${name}のウィジェット。見た目は本体の部品（WidgetCard・WidgetHint・DetailFrame など）で組み、
 * 中身の並べ方（flex・gap・字の大きさの段など）だけを Tailwind のクラスで書く。CSS のファイルは作らない
 * （使えるクラスは docs/design-system.md の「0. 書き方」。組み立てが、使ったクラスだけを dist/web.css に出す）。
 */

interface Config {
  pollIntervalMs: number;
}

interface Status {
  configured: boolean;
  message: string | null;
}

async function fetchStatus(ctx: WidgetProps["ctx"]): Promise<Status> {
  const res = await fetch(extensionApiUrl(ctx, "${id}", "/status"));
  if (!res.ok) throw new Error(\`${id} API error: \${res.status}\`);
  return res.json();
}

function ${pascal}View({ ctx, config, openDetail }: WidgetProps<Config>) {
  const { data, error } = usePolling(() => fetchStatus(ctx), config.pollIntervalMs);
  return (
    <WidgetCard className="gap-1.5 text-left" onClick={openDetail} label="${name}（詳しく見る）">
      <span className="text-title font-semibold">${name}</span>
      {error ? (
        <WidgetHint tone="error">読めませんでした</WidgetHint>
      ) : (
        <WidgetHint>{data?.configured ? data.message : "設定画面の「拡張機能 → ${name}」で設定してください"}</WidgetHint>
      )}
    </WidgetCard>
  );
}

function ${pascal}Detail({ ctx, config }: WidgetDetailProps<Config>) {
  const { data } = usePolling(() => fetchStatus(ctx), config.pollIntervalMs);
  return (
    <DetailFrame title="${name}">
      <Note>{data?.message ?? "まだ何もありません"}</Note>
    </DetailFrame>
  );
}

export const ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Widget = defineWidget<Config>({
  id: "${id}",
  name: "${name}",
  description: "${name}を表示します",
  defaultSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1000 },
  Component: ${pascal}View,
  DetailComponent: ${pascal}Detail,
});
`,
  );
  webParts.push(`import { ${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Widget } from "./widget";`);
  webEntries.push(`widgets: [${pascal.charAt(0).toLowerCase() + pascal.slice(1)}Widget]`);
}

if (withScreen) {
  files.set(
    "src/screen.tsx",
    `import {
  Button,
  ButtonRow,
  List,
  ListItem,
  ScreenFrame,
  ScreenNotice,
  ScreenSection,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";

/** ${name}の画面（サイドバーから開く）。枠は ScreenFrame、区切りは ScreenSection、一覧は List で組む */
export function ${pascal}Screen({ account }: ScreenProps) {
  return (
    <ScreenFrame title="${name}">
      <ScreenSection title="はじめに">
        <ScreenNotice>{account.username} さん、ここに中身を作ります。</ScreenNotice>
        <List>
          <ListItem title="1つめ" detail="説明" />
          <ListItem title="2つめ" detail="押せる行" onClick={() => undefined} />
        </List>
        <ButtonRow>
          <Button variant="primary">決める</Button>
          <Button>やめる</Button>
        </ButtonRow>
      </ScreenSection>
    </ScreenFrame>
  );
}
`,
  );
  webParts.push(`import { ${pascal}Screen } from "./screen";`);
  webEntries.push(
    `screens: [{ id: "${id}", label: "${name}", icon: "grid", order: 50, Component: ${pascal}Screen }]`,
  );
}

if (provides) webEntries.push(`provides: { "${provides}": { name: "${name}" } }`);

if (webEntries.length > 0) {
  files.set(
    "src/web.tsx",
    `import { ${[...webImports].join(", ")} } from "@home-dashboard/widget-sdk";
${webParts.join("\n")}

// 画面側。React と @home-dashboard/widget-sdk は本体のものを使う（ビルドの道具が同梱しないようにつなぐ）。
// 見た目は Tailwind のクラスで書く（CSS のファイルは作らない）
export default defineWebExtension({
  ${webEntries.join(",\n  ")},
});
`,
  );
}

for (const [path, content] of files) {
  const target = join(dir, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const shown = relative(process.cwd(), dir) || ".";
console.log(`作りました: ${shown}`);
for (const path of files.keys()) console.log(`  ${path}`);
console.log(`
次に:
  1. 型（SDK）を読めるようにする:  pnpm install
  2. 組み立てる（dist/ ができる）:  pnpm build:extension ${shown}
     本体の拡張機能なら、サーバーを起動し直すと読む。持ち込み用の ZIP は --zip を付ける（設定 →「拡張機能を持ち込む」）
手引き: docs/extensions.md`);
