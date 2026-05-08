import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function loadEnv(rootDir = process.cwd()) {
  for (const envPath of [join(rootDir, ".env"), join(dirname(rootDir), ".env")]) {
    let content = "";
    try {
      content = readFileSync(envPath, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

export function readGoogleClient(rootDir = process.cwd()) {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: process.env.GOOGLE_REDIRECT_URI ? [process.env.GOOGLE_REDIRECT_URI] : []
    };
  }

  const fileName = readdirSync(rootDir).find((file) => /^client_secret_.*\.json$/.test(file));
  if (!fileName) {
    throw new Error("Missing Google OAuth client_secret_*.json in Esmail root or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars");
  }

  const raw = JSON.parse(readFileSync(join(rootDir, fileName), "utf8"));
  const client = raw.web || raw.installed;
  if (!client?.client_id || !client?.client_secret) {
    throw new Error("Invalid Google OAuth client JSON");
  }
  return client;
}

function splitEnvList(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function config(rootDir = process.cwd()) {
  loadEnv(rootDir);
  const google = readGoogleClient(rootDir);
  const chatAnywhereBaseUrl = process.env.CHATANYWHERE_BASE_URL || "https://api.ikuncode.cc/v1";
  const aiModel = process.env.AI_MODEL || "gemini-3-flash";
  const backupApiKeys = [
    process.env.CHATANYWHERE_BACKUP_API_KEY || "",
    ...splitEnvList(process.env.CHATANYWHERE_BACKUP_API_KEYS || "")
  ].filter(Boolean);
  const backupBaseUrl = process.env.CHATANYWHERE_BACKUP_BASE_URL || "https://api.chatanywhere.tech/v1";
  const backupModel = process.env.CHATANYWHERE_BACKUP_MODEL || "gpt-5-mini";
  const chatAnywhereProviders = [
    process.env.CHATANYWHERE_API_KEY
      ? { apiKey: process.env.CHATANYWHERE_API_KEY, baseUrl: chatAnywhereBaseUrl, model: aiModel }
      : null,
    ...backupApiKeys.map((apiKey) => ({ apiKey, baseUrl: backupBaseUrl, model: backupModel }))
  ].filter(Boolean);

  return {
    apiPort: Number(process.env.API_PORT || 5175),
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5174",
    chatAnywhereApiKey: process.env.CHATANYWHERE_API_KEY || "",
    chatAnywhereApiKeys: chatAnywhereProviders.map((provider) => provider.apiKey),
    chatAnywhereProviders,
    chatAnywhereBaseUrl,
    aiModel,
    googleClientId: process.env.GOOGLE_CLIENT_ID || google.client_id,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || google.client_secret,
    googleRedirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      google.redirect_uris?.find((uri) => uri.includes("127.0.0.1")) ||
      google.redirect_uris?.[0]
  };
}
