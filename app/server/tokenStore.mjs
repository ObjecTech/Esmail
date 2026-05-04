import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const TOKEN_PATH = join(process.cwd(), ".data", "google-token.json");
const QQ_SESSION_PATH = join(process.cwd(), ".data", "qq-session.json");
const ACTIVE_PROVIDER_PATH = join(process.cwd(), ".data", "active-provider.json");
const requestStorage = new AsyncLocalStorage();
const COOKIE_NAMES = {
  token: "esmail_google_token",
  qq: "esmail_qq_session",
  provider: "esmail_active_provider"
};

function shouldUseCookies() {
  return Boolean(process.env.SESSION_SECRET && requestStorage.getStore()?.req && requestStorage.getStore()?.res);
}

export function withTokenStoreContext(req, res, callback) {
  return requestStorage.run({ req, res }, callback);
}

function cookieKey() {
  return createHash("sha256").update(process.env.SESSION_SECRET || "esmail-local-dev").digest();
}

function sign(value) {
  return createHash("sha256").update(`${process.env.SESSION_SECRET || "esmail-local-dev"}:${value}`).digest("base64url");
}

function encryptJson(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptJson(value) {
  try {
    const [ivText, tagText, encryptedText] = String(value || "").split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function encodeProvider(provider) {
  const value = String(provider || "google");
  return `${value}.${sign(value)}`;
}

function decodeProvider(value) {
  const [provider, signature] = String(value || "").split(".");
  if (!provider || !signature) return "google";
  const expected = sign(provider);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "google";
  } catch {
    return "google";
  }
  return provider;
}

function parseCookies() {
  const header = requestStorage.getStore()?.req?.headers?.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const res = requestStorage.getStore()?.res;
  if (!res) return;
  const cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) cookie.push("Secure");
  const next = cookie.join("; ");
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader("Set-Cookie", [...cookies, next]);
}

function clearCookie(name) {
  setCookie(name, "", 0);
}

export function readToken() {
  if (shouldUseCookies()) return decryptJson(parseCookies()[COOKIE_NAMES.token]);
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeToken(token) {
  if (shouldUseCookies()) {
    setCookie(COOKIE_NAMES.token, encryptJson(token));
    return;
  }
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function clearToken() {
  if (shouldUseCookies()) {
    clearCookie(COOKIE_NAMES.token);
    return;
  }
  try {
    rmSync(TOKEN_PATH);
  } catch {
    // Already logged out.
  }
}

export function readQqSession() {
  if (shouldUseCookies()) return decryptJson(parseCookies()[COOKIE_NAMES.qq]);
  try {
    return JSON.parse(readFileSync(QQ_SESSION_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeQqSession(session) {
  if (shouldUseCookies()) {
    setCookie(COOKIE_NAMES.qq, encryptJson(session));
    return;
  }
  mkdirSync(dirname(QQ_SESSION_PATH), { recursive: true });
  writeFileSync(QQ_SESSION_PATH, JSON.stringify(session, null, 2));
}

export function clearQqSession() {
  if (shouldUseCookies()) {
    clearCookie(COOKIE_NAMES.qq);
    return;
  }
  try {
    rmSync(QQ_SESSION_PATH);
  } catch {
    // Already logged out.
  }
}

export function readActiveProvider() {
  if (shouldUseCookies()) return decodeProvider(parseCookies()[COOKIE_NAMES.provider]);
  try {
    return JSON.parse(readFileSync(ACTIVE_PROVIDER_PATH, "utf8")).provider || "google";
  } catch {
    return "google";
  }
}

export function writeActiveProvider(provider) {
  if (shouldUseCookies()) {
    setCookie(COOKIE_NAMES.provider, encodeProvider(provider));
    return;
  }
  mkdirSync(dirname(ACTIVE_PROVIDER_PATH), { recursive: true });
  writeFileSync(ACTIVE_PROVIDER_PATH, JSON.stringify({ provider }, null, 2));
}

export function clearActiveProvider() {
  if (shouldUseCookies()) {
    clearCookie(COOKIE_NAMES.provider);
    return;
  }
  try {
    rmSync(ACTIVE_PROVIDER_PATH);
  } catch {
    // Already logged out.
  }
}
