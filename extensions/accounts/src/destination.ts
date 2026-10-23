import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * 管理者でない人が足すアカウントの接続先（IMAP・SMTP・CalDAV・iCal）を確かめる。
 * サーバーは家の中にあるので、接続先を自由に決められると、家の中の機器（ルーター・Home Assistant・このダッシュボード自身）へ
 * つながせて、つながる・つながらないの違いから中を探れてしまう。管理者でない人の接続先は、外のサーバーだけにする。
 * 名前は引いてから判定する（名前だけ外向きにして、引くと家の中を指すものも断る）
 */

function v4Parts(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) ? parts : null;
}

function isInternalV4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT（Tailscale の 100.x も含む）
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // 機器の試験用
    a >= 224
  );
}

/** IPv6 を 16bit ×8 に広げる（:: の省略と、末尾の a.b.c.d の書き方も読む）。読めなければ null */
function v6Words(address: string): number[] | null {
  let text = address.toLowerCase().replace(/%.*$/, "");
  const tail = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = v4Parts(tail[2]);
    if (!v4) return null;
    text = `${tail[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const read = (part: string) => (part ? part.split(":").map((w) => (/^[0-9a-f]{1,4}$/.test(w) ? parseInt(w, 16) : NaN)) : []);
  const head = read(halves[0]);
  const rest = halves.length === 2 ? read(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  const words = [...head, ...new Array(Math.max(0, fill)).fill(0), ...rest];
  return words.length === 8 && words.every((w) => Number.isInteger(w)) ? words : null;
}

/** 家の中・この機械・リンクローカルなど、外ではない宛先か */
export function isInternalAddress(address: string): boolean {
  const v4 = v4Parts(address);
  if (v4) return isInternalV4(v4);
  const w = v6Words(address);
  if (!w) return true; // 読めない宛先は外とみなさない
  const v4Of = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  // IPv4 を写した形（::ffff:a.b.c.d・::a.b.c.d・NAT64 の 64:ff9b::/96・6to4 の 2002::/16）は、中の IPv4 で判定する
  if (w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0)) {
    if (w[5] === 0 && w[6] === 0 && w[7] <= 1) return true; // :: と ::1
    return isInternalV4(v4Of(w[6], w[7]));
  }
  if (w[0] === 0x64 && w[1] === 0xff9b && w.slice(2, 6).every((x) => x === 0)) return isInternalV4(v4Of(w[6], w[7]));
  if (w[0] === 0x2002) return isInternalV4(v4Of(w[1], w[2]));
  return (
    (w[0] & 0xfe00) === 0xfc00 || // ユニークローカル fc00::/7
    (w[0] & 0xffc0) === 0xfe80 || // リンクローカル fe80::/10
    (w[0] & 0xffc0) === 0xfec0 || // サイトローカル（古い）
    (w[0] & 0xff00) === 0xff00 // マルチキャスト
  );
}

/** host が外のサーバーでなければ false（引けない名前も false） */
export async function isPublicHost(host: string): Promise<boolean> {
  const name = host.replace(/^\[|\]$/g, "");
  if (/^localhost$/i.test(name) || /\.(local|lan|home|internal|localhost)$/i.test(name)) return false;
  try {
    const addresses = isIP(name) ? [{ address: name }] : await lookup(name, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isInternalAddress(address));
  } catch {
    return false;
  }
}
