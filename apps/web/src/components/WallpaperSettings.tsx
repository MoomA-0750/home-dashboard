import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { wallpaperImageUrl, type WallpaperInfo } from "../lib/useWallpaper";
import {
  applyShading,
  dimmedBrightness,
  dimsFor,
  getAnalysis,
  haloFor,
  onAnalysis,
  TARGET_LUMINANCE,
  type ZoneAnalysis,
} from "@home-dashboard/ui/wallpaper";
import { Button, ButtonRow, cx, defineMessages, List, ListItem, Message, Note, SectionTitle, Slider } from "@home-dashboard/widget-sdk";
import { SLIDER_ROW, SLIDER_ROW_LABEL, STACK } from "./settingsStyles";

/** 壁紙の見本（画面と同じく、縁の角を丸めた枠に敷き詰める） */
const PREVIEW = "relative w-full rounded-inner border border-glass-border bg-cover bg-center";
/** 場所の番号（見本の上と、下の一覧の行の頭で同じ形にして、対応させる） */
const ZONE_NUMBER = "inline-grid size-6 place-items-center rounded-full bg-shade/70 text-caption font-semibold";

interface WallpaperSettingsProps {
  apiBaseUrl: string;
  wallpaper: WallpaperInfo | null;
  isAdmin: boolean;
  onChange: (info: WallpaperInfo) => void;
}

const messages = defineMessages({
  ja: {
    shrinkFailed: "画像を縮められませんでした",
    requestFailed: "うまくいきませんでした（{status}）",
    changed: "壁紙を替えました",
    unreadable: "画像を読めませんでした",
    note: "ダッシュボードの背景の写真です。全部の端末で同じ壁紙になります。",
    custom: "選んだ写真",
    default: "既定の写真",
    sending: "送っています…",
    choose: "写真を選ぶ",
    restored: "既定の写真に戻しました",
    restore: "既定の写真に戻す",
    adminOnly: "壁紙を変えられるのは管理者だけです。",
    formats: "PNG・JPEG・WebP（20MB まで）。大きな写真は長い辺 3840px に縮めて送ります。",
    dimTitle: "明るい所の暗さ",
    dimNote:
      "壁紙の明るい所に文字が重なっても読めるよう、画面の場所ごとに明るさを測り、暗さを足しています。「強さ」が 100% で、明るい所が目安（{target}%）まで暗くなります。暗すぎると感じたら下げてください。",
    zone: "画面の横 {from}〜{to}%",
    brightness: "明るさ {before}% → {after}%",
    added: "足す暗さ {dim}%",
    nothing: "足さない",
    strength: "強さ {value}%",
    strengthLabel: "明るい所に足す暗さの強さ",
    measuring: "壁紙を測っています…",
    dimAdminOnly: "強さを変えられるのは管理者だけです。",
    halo: "文字の影の濃さ {value}%（足した後も明るい所が残るほど濃くする）",
  },
  en: {
    shrinkFailed: "Couldn't shrink the image",
    requestFailed: "Something went wrong ({status})",
    changed: "Wallpaper changed",
    unreadable: "Couldn't read the image",
    note: "The background photo of the dashboard. Every device shows the same wallpaper.",
    custom: "Your photo",
    default: "Default photo",
    sending: "Uploading…",
    choose: "Choose photo",
    restored: "Restored the default photo",
    restore: "Restore default photo",
    adminOnly: "Only admins can change the wallpaper.",
    formats: "PNG, JPEG, or WebP (up to 20 MB). Large photos are scaled down to 3840 px on the long edge before uploading.",
    dimTitle: "Darkening bright areas",
    dimNote:
      "So text stays readable over bright parts of the wallpaper, each part of the screen is measured and darkened. At 100% strength, bright areas are darkened to the target ({target}%). Lower it if the screen looks too dark.",
    zone: "Screen width {from}–{to}%",
    brightness: "Brightness {before}% → {after}%",
    added: "Darkened by {dim}%",
    nothing: "None",
    strength: "Strength {value}%",
    strengthLabel: "Strength of darkening for bright areas",
    measuring: "Measuring the wallpaper…",
    dimAdminOnly: "Only admins can change the strength.",
    halo: "Text shadow {value}% (stronger where bright areas remain after darkening)",
  },
});

// 大きすぎる写真は、送る前にこの大きさ（長い辺）まで縮める。4K の画面でも粗く見えない大きさ
const MAX_EDGE = 3840;
const REENCODE_OVER_BYTES = 4 * 1024 * 1024;

/** 長い辺が MAX_EDGE を超える・ファイルが大きい写真は、縮めて JPEG にし直す。それ以外はそのまま送る */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= REENCODE_OVER_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(messages.t("shrinkFailed")))),
      "image/jpeg",
      0.9,
    ),
  );
}

const percent = (value: number) => Math.round(value * 100);

/**
 * 明るい所に足す暗さ（@home-dashboard/ui の wallpaperTheme.ts）を見て、強さを変える。プレビューの上に足している暗さを重ね、
 * 場所ごとに「明るさ（足す前 → 足した後）」と「足す暗さ」、それに合わせた文字の影の濃さを出す。つまみを動かすと、画面全体にもすぐ当てて見せ、
 * 離したときに保存する（全部の端末に知らせる）
 */
function DimSettings({
  apiBaseUrl,
  wallpaper,
  imageUrl,
  isAdmin,
  onChange,
}: {
  apiBaseUrl: string;
  wallpaper: WallpaperInfo | null;
  imageUrl: string;
  isAdmin: boolean;
  onChange: (info: WallpaperInfo) => void;
}) {
  const t = messages.useT();
  const [zones, setZones] = useState<ZoneAnalysis[] | null>(getAnalysis);
  const saved = wallpaper?.dimStrength ?? 1;
  const [strength, setStrength] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAnalysis(setZones), []);
  useEffect(() => setStrength(saved), [saved]);

  const dims = zones ? dimsFor(zones, strength) : [];
  const preview = (value: number) => {
    setStrength(value);
    if (zones) applyShading(zones, value);
  };
  const save = async (value: number) => {
    if (value === saved) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/wallpaper/dim`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimStrength: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("requestFailed", { status: res.status }));
      onChange(body as WallpaperInfo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // 画面と同じ縦横比で、画面に重ねているのと同じ暗さを重ねる
  const overlay =
    dims.length === 4
      ? `linear-gradient(to right, rgba(var(--shade-rgb), ${dims[0]}) 12%, rgba(var(--shade-rgb), ${dims[1]}) 42%, rgba(var(--shade-rgb), ${dims[2]}) 67%, rgba(var(--shade-rgb), ${dims[3]}) 90%)`
      : "none";
  const aspect = typeof window === "undefined" ? 16 / 9 : Math.min(2.4, Math.max(0.5, window.innerWidth / window.innerHeight));

  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle>{t("dimTitle")}</SectionTitle>
      <Note>{t("dimNote", { target: percent(TARGET_LUMINANCE) })}</Note>
      {/* 画面と同じ縦横比で、高さは画面の4割まで（縦長のスマホでも、場所ごとの数字まで一度に見える） */}
      <div
        className={cx(PREVIEW, "wallpaper-preview-fit aspect-(--preview-aspect) overflow-hidden")}
        style={{ backgroundImage: `${overlay}, url("${imageUrl}")`, "--preview-aspect": String(aspect) } as CSSProperties}
      >
        {zones?.map((zone, index) => (
          <span
            key={zone.from}
            className="absolute inset-y-0 flex items-end border-l border-dashed border-tint/45"
            style={{ left: `${zone.from * 100}%`, width: `${(zone.to - zone.from) * 100}%` }}
          >
            <span className={cx(ZONE_NUMBER, "mb-2 ml-2")}>{index + 1}</span>
          </span>
        ))}
      </div>
      {zones && (
        <List boxed label={t("dimTitle")}>
          {zones.map((zone, index) => (
            <ListItem
              key={zone.from}
              leading={<span className={cx(ZONE_NUMBER, "border border-glass-border")}>{index + 1}</span>}
              title={t("zone", { from: percent(zone.from), to: percent(zone.to) })}
              detail={t("brightness", {
                before: percent(zone.bright),
                after: percent(dimmedBrightness(zone.bright, dims[index] ?? 0)),
              })}
              trailing={
                <span className="shrink-0 text-label text-muted">
                  {(dims[index] ?? 0) > 0 ? t("added", { dim: percent(dims[index]) }) : t("nothing")}
                </span>
              }
              chevron={false}
            />
          ))}
        </List>
      )}
      {zones && <Note>{t("halo", { value: percent(haloFor(zones, dims)) })}</Note>}
      {!zones && <Note>{t("measuring")}</Note>}
      <div className={SLIDER_ROW}>
        <span className={SLIDER_ROW_LABEL}>{t("strength", { value: percent(strength) })}</span>
        <Slider
          className="flex-1"
          value={strength}
          max={1.5}
          step={0.05}
          disabled={!isAdmin}
          label={t("strengthLabel")}
          valueText={`${percent(strength)}%`}
          onInput={preview}
          onCommit={(value) => {
            preview(value);
            void save(value);
          }}
        />
      </div>
      {!isAdmin && <Note>{t("dimAdminOnly")}</Note>}
      {error && <Message tone="error">{error}</Message>}
    </section>
  );
}

/** 設定画面の「壁紙」。全部の端末で同じ壁紙になる。変えるのは管理者だけ */
export function WallpaperSettings({ apiBaseUrl, wallpaper, isAdmin, onChange }: WallpaperSettingsProps) {
  const t = messages.useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (init: RequestInit, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/wallpaper`, init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("requestFailed", { status: res.status }));
      onChange(body as WallpaperInfo);
      setMessage({ ok: true, text: done });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const image = await prepareImage(file);
      await send(
        { method: "PUT", headers: { "Content-Type": image.type || "application/octet-stream" }, body: image },
        t("changed"),
      );
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : t("unreadable") });
    }
  };

  const current = wallpaperImageUrl(apiBaseUrl, wallpaper ?? { custom: false, version: null });

  return (
    <section className={STACK}>
      <Note>{t("note")}</Note>
      <div className={cx(PREVIEW, "aspect-video")} style={{ backgroundImage: `url("${current}")` }}>
        {/* 角の丸みを見本とそろえる（見本の丸み ＝ 札の丸み ＋ 余白） */}
        <span className="glass absolute top-1 left-1 rounded-art px-3 py-1.5 text-note">
          {wallpaper?.custom ? t("custom") : t("default")}
        </span>
      </div>
      {isAdmin ? (
        <ButtonRow>
          <Button icon="image" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t("sending") : t("choose")}
          </Button>
          {wallpaper?.custom && (
            <Button icon="arrow-sync" disabled={busy} onClick={() => void send({ method: "DELETE" }, t("restored"))}>
              {t("restore")}
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => void handleFile(event)}
          />
        </ButtonRow>
      ) : (
        <Note>{t("adminOnly")}</Note>
      )}
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      <Note>{t("formats")}</Note>
      <DimSettings apiBaseUrl={apiBaseUrl} wallpaper={wallpaper} imageUrl={current} isAdmin={isAdmin} onChange={onChange} />
    </section>
  );
}
