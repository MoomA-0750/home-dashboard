import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { join } from "node:path";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  checkLockout,
  loadAccounts,
  readJson,
  recordFailure,
  serial,
  startSession,
  toAccountInfo,
  writeJson,
  type AuthContext,
} from "./accounts.js";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * パスキー（WebAuthn）でのログイン。パスワードの代わりに、端末の指紋・顔・PIN で入る。
 *
 * - パスキーは開いたアドレス（https://general-console.….ts.net など）に結び付く。別のアドレスで作ったものは使えない
 * - ブラウザは IP アドレス（https://192.168.1.10 など）ではパスキーを使わせないので、名前のあるアドレスで開いたときだけ使える
 * - サーバーには公開鍵だけを置く（data/ が漏れてもなりすませない）
 * - 名前を打たずに選べるよう、端末にアカウントごと覚えさせる（discoverable credential）。本人確認（指紋・PIN など）は必ず求める
 */

const PASSKEYS_PATH = join(config.dataDir, "passkeys.json");
const RP_NAME = "Home Dashboard";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES = 64;
const MAX_PASSKEYS_PER_ACCOUNT = 16;
const PASSKEY_NAME_MAX_LENGTH = 40;

interface StoredPasskey {
  /** credential ID（base64url） */
  id: string;
  accountId: string;
  /** 公開鍵（COSE。base64url） */
  publicKey: string;
  counter: number;
  transports: AuthenticatorTransportFuture[];
  /** 作ったときのアドレスのホスト名。違うアドレスでは使えないので、一覧で見分けるために出す */
  rpId: string;
  name: string;
  /** 端末をまたいで同期されるパスキーか（iCloud キーチェーン・Google パスワードマネージャーなど） */
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PasskeyInfo {
  id: string;
  accountId: string;
  name: string;
  rpId: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Challenge {
  challenge: string;
  rpId: string;
  origin: string;
  /** 登録・本人確認のときの持ち主。ログインのときは無い */
  accountId?: string;
  expiresAt: number;
}

let passkeys: StoredPasskey[] | null = null;
const challenges = new Map<string, Challenge>();

async function loadPasskeys(): Promise<StoredPasskey[]> {
  passkeys ??= await readJson<StoredPasskey>(PASSKEYS_PATH);
  // 消されたアカウントのものは使わない
  const accountIds = new Set((await loadAccounts()).map((a) => a.id));
  return passkeys.filter((p) => accountIds.has(p.accountId));
}

async function savePasskeys(next: StoredPasskey[]): Promise<void> {
  passkeys = next;
  await writeJson(PASSKEYS_PATH, next);
}

function toInfo(passkey: StoredPasskey): PasskeyInfo {
  const { id, accountId, name, rpId, backedUp, createdAt, lastUsedAt } = passkey;
  return { id, accountId, name, rpId, backedUp, createdAt, lastUsedAt };
}

/** ブラウザが開いているアドレス（Origin ヘッダー）から、パスキーを結び付けるホスト名を決める */
export function relyingParty(origin: unknown): { origin: string; rpId: string } {
  let url: URL;
  try {
    url = new URL(String(origin));
  } catch {
    throw new ServiceError(400, "開いているアドレスが分かりません", "Cannot tell which address this page was opened at");
  }
  const rpId = url.hostname;
  if (isIP(rpId.replace(/^\[|\]$/g, "")))
    throw new ServiceError(
      400,
      "IP アドレスで開いているとパスキーは使えません。名前のあるアドレス（tailnet の …ts.net など）で開いてください",
    );
  if (url.protocol !== "https:" && rpId !== "localhost")
    throw new ServiceError(400, "パスキーは https で開いたときだけ使えます", "Passkeys only work when the page is opened over https");
  return { origin: url.origin, rpId };
}

function putChallenge(entry: Challenge): string {
  const now = Date.now();
  for (const [key, value] of challenges) if (value.expiresAt < now) challenges.delete(key);
  // 多すぎるときは古いものから捨てる（Map は入れた順に並ぶ）
  while (challenges.size >= MAX_CHALLENGES) challenges.delete(challenges.keys().next().value!);
  const id = randomBytes(16).toString("base64url");
  challenges.set(id, entry);
  return id;
}

/** 一度だけ使える。期限切れや、違うアドレスからのものは断る */
function takeChallenge(id: unknown, origin: string): Challenge {
  const entry = typeof id === "string" ? challenges.get(id) : undefined;
  if (typeof id === "string") challenges.delete(id);
  if (!entry || entry.expiresAt < Date.now() || entry.origin !== origin)
    throw new ServiceError(400, "時間が経ちすぎました。もう一度やり直してください", "This took too long. Please try again");
  return entry;
}

function checkName(name: unknown): string {
  const text = typeof name === "string" ? name.trim().slice(0, PASSKEY_NAME_MAX_LENGTH) : "";
  return text || "パスキー";
}

/** 自分のパスキー（管理者でも自分の分だけ。ほかの人のは、そのアカウントを消すと消える） */
export async function listPasskeys(auth: AuthContext): Promise<PasskeyInfo[]> {
  return (await loadPasskeys())
    .filter((p) => p.accountId === auth.account.id)
    .map(toInfo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** パスキーを作る準備。ブラウザの navigator.credentials.create に渡す値と、答え合わせに使う id を返す */
export async function startRegistration(auth: AuthContext, origin: unknown) {
  const rp = relyingParty(origin);
  const mine = (await loadPasskeys()).filter((p) => p.accountId === auth.account.id);
  if (mine.length >= MAX_PASSKEYS_PER_ACCOUNT) throw new ServiceError(409, "パスキーが多すぎます", "Too many passkeys");
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpId,
    userName: auth.account.username,
    userID: new TextEncoder().encode(auth.account.id),
    attestationType: "none",
    // 同じ端末に二重に作らない
    excludeCredentials: mine.filter((p) => p.rpId === rp.rpId).map((p) => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = putChallenge({
    challenge: options.challenge,
    ...rp,
    accountId: auth.account.id,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return { challengeId, options };
}

/** 端末が作ったパスキーを確かめて登録する */
export async function finishRegistration(auth: AuthContext, origin: unknown, challengeId: unknown, response: unknown, name: unknown) {
  const rp = relyingParty(origin);
  const entry = takeChallenge(challengeId, rp.origin);
  if (entry.accountId !== auth.account.id) throw new ServiceError(400, "もう一度やり直してください", "Please try again");
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: entry.challenge,
      expectedOrigin: entry.origin,
      expectedRPID: entry.rpId,
      requireUserVerification: true,
    });
  } catch {
    throw new ServiceError(400, "パスキーを確かめられませんでした", "Could not verify the passkey");
  }
  if (!verification.verified) throw new ServiceError(400, "パスキーを確かめられませんでした", "Could not verify the passkey");
  const { credential, credentialBackedUp } = verification.registrationInfo;
  return serial(async () => {
    const current = await loadPasskeys();
    if (current.some((p) => p.id === credential.id)) throw new ServiceError(409, "このパスキーはもう登録されています", "This passkey is already registered");
    const passkey: StoredPasskey = {
      id: credential.id,
      accountId: auth.account.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      rpId: entry.rpId,
      name: checkName(name),
      backedUp: credentialBackedUp,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    await savePasskeys([...current, passkey]);
    return toInfo(passkey);
  });
}

/** パスキーでのログインの準備。名前を打たずに端末に選ばせるので、どのパスキーかは指定しない */
export async function startLogin(origin: unknown) {
  const rp = relyingParty(origin);
  checkLockout("", Date.now());
  const options = await generateAuthenticationOptions({ rpID: rp.rpId, userVerification: "required" });
  const challengeId = putChallenge({ challenge: options.challenge, ...rp, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return { challengeId, options };
}

/** 端末の署名を確かめ、合っていれば使ったパスキーの数を進める。合わなければ失敗を数えて断る */
async function verifyAssertion(entry: Challenge, response: unknown, now: number): Promise<StoredPasskey> {
  const answer = response as AuthenticationResponseJSON;
  const fail = (): never => {
    recordFailure("", now);
    throw new ServiceError(401, "このパスキーではログインできません（消されたか、別のアドレスで作ったものです）", "This passkey cannot sign in (it was removed, or made for a different address)");
  };
  const passkey = (await loadPasskeys()).find((p) => typeof answer?.id === "string" && p.id === answer.id);
  if (!passkey || passkey.rpId !== entry.rpId) return fail();
  // 本人確認のときは、確かめている人のパスキーだけを通す
  if (entry.accountId && passkey.accountId !== entry.accountId) return fail();
  // 端末が添えてくる持ち主（作るときに渡したアカウントの id）とも合わせる
  const userHandle = answer.response?.userHandle;
  if (userHandle && Buffer.from(userHandle, "base64url").toString("utf-8") !== passkey.accountId) return fail();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: answer,
      expectedChallenge: entry.challenge,
      expectedOrigin: entry.origin,
      expectedRPID: entry.rpId,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });
  } catch {
    return fail();
  }
  if (!verification.verified) return fail();
  await serial(async () => {
    const current = await loadPasskeys();
    await savePasskeys(
      current.map((p) =>
        p.id === passkey.id
          ? { ...p, counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() }
          : p,
      ),
    );
  });
  return passkey;
}

/** 端末の署名を確かめてログインする */
export async function finishLogin(origin: unknown, challengeId: unknown, response: unknown, deviceName: unknown) {
  const rp = relyingParty(origin);
  const now = Date.now();
  checkLockout("", now);
  const entry = takeChallenge(challengeId, rp.origin);
  const passkey = await verifyAssertion(entry, response, now);
  const account = (await loadAccounts()).find((a) => a.id === passkey.accountId);
  if (!account) throw new ServiceError(401, "このパスキーではログインできません（消されたか、別のアドレスで作ったものです）", "This passkey cannot sign in (it was removed, or made for a different address)");
  return serial(async () => ({ ...(await startSession(account, deviceName)), account: toAccountInfo(account) }));
}

/**
 * ログインしている人の本人確認の準備（音声アシスタントの解錠などを許可する前に、端末の指紋・顔・PIN を求める）。
 * その人がこのアドレスで作ったパスキーだけを選ばせる
 */
export async function startReauth(auth: AuthContext, origin: unknown) {
  const rp = relyingParty(origin);
  const own = (await loadPasskeys()).filter((p) => p.accountId === auth.account.id && p.rpId === rp.rpId);
  if (own.length === 0)
    throw new ServiceError(404, "このアドレスで作ったパスキーがありません。パスワードで確かめてください", "No passkey for this address. Use your password instead");
  const options = await generateAuthenticationOptions({
    rpID: rp.rpId,
    userVerification: "required",
    allowCredentials: own.map((p) => ({ id: p.id, transports: p.transports })),
  });
  const challengeId = putChallenge({
    challenge: options.challenge,
    ...rp,
    accountId: auth.account.id,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return { challengeId, options };
}

/** 本人確認の署名を確かめる（合わなければ ServiceError） */
export async function finishReauth(auth: AuthContext, origin: unknown, challengeId: unknown, response: unknown): Promise<void> {
  const rp = relyingParty(origin);
  const now = Date.now();
  checkLockout("", now);
  const entry = takeChallenge(challengeId, rp.origin);
  if (entry.accountId !== auth.account.id)
    throw new ServiceError(400, "時間が経ちすぎました。もう一度やり直してください", "This took too long. Please try again");
  await verifyAssertion(entry, response, now);
}

export function renamePasskey(auth: AuthContext, id: string, name: unknown) {
  return serial(async () => {
    const current = await loadPasskeys();
    const target = current.find((p) => p.id === id && p.accountId === auth.account.id);
    if (!target) throw new ServiceError(404, "そのパスキーは見つかりません", "Passkey not found");
    const next = { ...target, name: checkName(name) };
    await savePasskeys(current.map((p) => (p.id === id ? next : p)));
    return toInfo(next);
  });
}

export function deletePasskey(auth: AuthContext, id: string) {
  return serial(async () => {
    const current = await loadPasskeys();
    if (!current.some((p) => p.id === id && p.accountId === auth.account.id))
      throw new ServiceError(404, "そのパスキーは見つかりません", "Passkey not found");
    await savePasskeys(current.filter((p) => p.id !== id));
  });
}

export function resetPasskeysForTest(): void {
  passkeys = [];
  challenges.clear();
}
