import { afterEach, describe, expect, it, vi } from "vitest";
import { askAssistant } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("API helpers", () => {
  it("times out assistant requests so the app can fall back locally", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })) as typeof fetch;

    const request = askAssistant("测试", "zh", []);
    const expectation = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;
  });
});
