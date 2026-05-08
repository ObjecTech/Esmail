import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { config, loadEnv } from "./env.mjs";

const originalKey = process.env.CHATANYWHERE_API_KEY;
const originalBaseUrl = process.env.CHATANYWHERE_BASE_URL;
const originalAiModel = process.env.AI_MODEL;
const originalBackupKey = process.env.CHATANYWHERE_BACKUP_API_KEY;
const originalBackupKeys = process.env.CHATANYWHERE_BACKUP_API_KEYS;
const originalBackupBaseUrl = process.env.CHATANYWHERE_BACKUP_BASE_URL;
const originalBackupModel = process.env.CHATANYWHERE_BACKUP_MODEL;
const tempDirs = [];

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.CHATANYWHERE_API_KEY;
  } else {
    process.env.CHATANYWHERE_API_KEY = originalKey;
  }
  if (originalBaseUrl === undefined) {
    delete process.env.CHATANYWHERE_BASE_URL;
  } else {
    process.env.CHATANYWHERE_BASE_URL = originalBaseUrl;
  }
  if (originalAiModel === undefined) {
    delete process.env.AI_MODEL;
  } else {
    process.env.AI_MODEL = originalAiModel;
  }
  if (originalBackupKey === undefined) {
    delete process.env.CHATANYWHERE_BACKUP_API_KEY;
  } else {
    process.env.CHATANYWHERE_BACKUP_API_KEY = originalBackupKey;
  }
  if (originalBackupKeys === undefined) {
    delete process.env.CHATANYWHERE_BACKUP_API_KEYS;
  } else {
    process.env.CHATANYWHERE_BACKUP_API_KEYS = originalBackupKeys;
  }
  if (originalBackupBaseUrl === undefined) {
    delete process.env.CHATANYWHERE_BACKUP_BASE_URL;
  } else {
    process.env.CHATANYWHERE_BACKUP_BASE_URL = originalBackupBaseUrl;
  }
  if (originalBackupModel === undefined) {
    delete process.env.CHATANYWHERE_BACKUP_MODEL;
  } else {
    process.env.CHATANYWHERE_BACKUP_MODEL = originalBackupModel;
  }
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("env loading", () => {
  it("loads parent .env when the app is started from the esmail subdirectory", () => {
    delete process.env.CHATANYWHERE_API_KEY;
    const root = mkdtempSync(join(tmpdir(), "esmail-env-"));
    tempDirs.push(root);
    const child = join(root, "esmail");
    mkdirSync(child);
    writeFileSync(join(root, ".env"), "CHATANYWHERE_API_KEY=parent-test-key\n");

    loadEnv(child);

    expect(process.env.CHATANYWHERE_API_KEY).toBe("parent-test-key");
  });

  it("builds an ordered ChatAnywhere key list from primary and backup API keys", () => {
    process.env.CHATANYWHERE_API_KEY = "primary-test-key";
    process.env.CHATANYWHERE_BACKUP_API_KEY = "backup-test-key";
    process.env.CHATANYWHERE_BACKUP_API_KEYS = "backup-two, backup-three";
    process.env.CHATANYWHERE_BASE_URL = "https://api.ikuncode.cc/v1";
    process.env.AI_MODEL = "gemini-3-flash";
    process.env.CHATANYWHERE_BACKUP_BASE_URL = "https://api.chatanywhere.tech/v1";
    process.env.CHATANYWHERE_BACKUP_MODEL = "gpt-5-mini";
    const root = mkdtempSync(join(tmpdir(), "esmail-env-"));
    tempDirs.push(root);
    writeFileSync(join(root, "client_secret_test.json"), JSON.stringify({
      web: {
        client_id: "google-client",
        client_secret: "google-secret",
        redirect_uris: ["http://127.0.0.1:5175/api/auth/google/callback"]
      }
    }));

    expect(config(root).chatAnywhereApiKeys).toEqual([
      "primary-test-key",
      "backup-test-key",
      "backup-two",
      "backup-three"
    ]);
    expect(config(root).chatAnywhereProviders.map((provider) => provider.model)).toEqual([
      "gemini-3-flash",
      "gpt-5-mini",
      "gpt-5-mini",
      "gpt-5-mini"
    ]);
    expect(config(root).chatAnywhereProviders.map((provider) => provider.baseUrl)).toEqual([
      "https://api.ikuncode.cc/v1",
      "https://api.chatanywhere.tech/v1",
      "https://api.chatanywhere.tech/v1",
      "https://api.chatanywhere.tech/v1"
    ]);
  });
});
