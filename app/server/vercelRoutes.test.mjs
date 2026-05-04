import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("Vercel API routes", () => {
  it("exposes Gmail message detail requests as a dedicated serverless route", () => {
    expect(existsSync(join(rootDir, "api/gmail/messages/[messageId].mjs"))).toBe(true);
  });
});
