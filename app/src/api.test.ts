import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeInbox, askAssistant } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("API helpers", () => {
  it("requests inbox analysis in English by default", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ analysis: [] })
    }) as typeof fetch;

    await analyzeInbox([]);

    const body = JSON.parse((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.language).toBe("en");
  });

  it("gives assistant requests enough time before falling back locally", async () => {
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
    await vi.advanceTimersByTimeAsync(44_999);
    await Promise.resolve();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    await expectation;
  });
});
