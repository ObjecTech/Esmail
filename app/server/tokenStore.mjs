import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const TOKEN_PATH = join(process.cwd(), ".data", "google-token.json");
const QQ_SESSION_PATH = join(process.cwd(), ".data", "qq-session.json");
const ACTIVE_PROVIDER_PATH = join(process.cwd(), ".data", "active-provider.json");

export function readToken() {
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeToken(token) {
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function clearToken() {
  try {
    rmSync(TOKEN_PATH);
  } catch {
    // Already logged out.
  }
}

export function readQqSession() {
  try {
    return JSON.parse(readFileSync(QQ_SESSION_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function writeQqSession(session) {
  mkdirSync(dirname(QQ_SESSION_PATH), { recursive: true });
  writeFileSync(QQ_SESSION_PATH, JSON.stringify(session, null, 2));
}

export function clearQqSession() {
  try {
    rmSync(QQ_SESSION_PATH);
  } catch {
    // Already logged out.
  }
}

export function readActiveProvider() {
  try {
    return JSON.parse(readFileSync(ACTIVE_PROVIDER_PATH, "utf8")).provider || "google";
  } catch {
    return "google";
  }
}

export function writeActiveProvider(provider) {
  mkdirSync(dirname(ACTIVE_PROVIDER_PATH), { recursive: true });
  writeFileSync(ACTIVE_PROVIDER_PATH, JSON.stringify({ provider }, null, 2));
}

export function clearActiveProvider() {
  try {
    rmSync(ACTIVE_PROVIDER_PATH);
  } catch {
    // Already logged out.
  }
}
