import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChatPayload, buildContextualChatPrompt, callChatAnywhere, fallbackAnalysis, fallbackChatReply, shouldAnswerFromInboxContext, soundsLikeMissingMailboxAccess, summarizeAnalysisPrompt } from "./ai.mjs";

const originalFetch = global.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("server AI helpers", () => {
  it("builds ChatAnywhere chat-completions payloads for GPT-5 mini", () => {
    const payload = buildChatPayload({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "总结今天未读的重要邮件" }]
    });

    expect(payload.model).toBe("gpt-5-mini");
    expect(payload.messages[0].role).toBe("system");
    expect(payload.messages.at(-1)).toEqual({ role: "user", content: "总结今天未读的重要邮件" });
    expect(payload.temperature).toBeLessThanOrEqual(0.4);
  });

  it("asks the model for English inbox analysis JSON by default", () => {
    const prompt = summarizeAnalysisPrompt([
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: []
      }
    ]);

    expect(prompt).toContain("JSON");
    expect(prompt).toContain("summaryBullets");
    expect(prompt).toContain("1-5 concise English bullets");
    expect(prompt).toContain("ENT208 feedback");
    expect(prompt).not.toContain("1-5 条");
  });

  it("asks for Chinese inbox summaries when the selected app language is Chinese", () => {
    const prompt = summarizeAnalysisPrompt([
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "Today",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: []
      }
    ], "zh");

    expect(prompt).toContain("只返回 JSON");
    expect(prompt).toContain("summaryBullets");
    expect(prompt).toContain("1-5 条");
    expect(prompt).not.toContain("1-5 concise English bullets");
  });

  it("passes inbox context into assistant chat", () => {
    const prompt = buildContextualChatPrompt("总结今天未读的重要邮件", [
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: []
      }
    ]);

    expect(prompt).toContain("inbox context");
    expect(prompt).toContain("ENT208 feedback");
    expect(prompt).toContain("User question");
  });

  it("falls back to actual provided emails when summarizing important mail", () => {
    const reply = fallbackChatReply("总结今天未读的重要邮件", "zh", [
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: []
      }
    ]);

    expect(reply).toContain("Tutor");
    expect(reply).toContain("ENT208 feedback");
  });

  it("falls back to matching provided mail for search-like questions", () => {
    const reply = fallbackChatReply("chaoqun老师考试安排时间", "zh", [
      {
        id: "accommodation",
        senderName: "Accommodation.TC",
        senderEmail: "accommodation@example.edu",
        subject: "【再次提醒】2026年西浦创业家公寓",
        snippet: "考试结束后尽快完成退宿安排。",
        body: "考试结束后尽快完成退宿安排。",
        dateLabel: "5/5",
        fallbackCategoryId: "deadline",
        fallbackCategoryIds: ["deadline"],
        priority: "high",
        summaryBullets: []
      },
      {
        id: "lecture",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Week 10 Lecture & Lab",
        snippet: "DTS206TC week 10 lecture and lab arrangement.",
        body: "The lecture and lab arrangement may include assessment information.",
        dateLabel: "5/4",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: []
      },
      {
        id: "exam",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "Final Exam Schedule and room arrangement for DTS206TC.",
        body: "The final exam schedule is available in this message.",
        dateLabel: "4/30",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: []
      }
    ]);

    expect(reply).toContain("Chaoqun Wang");
    expect(reply).toContain("DTS206TC");
    expect(reply).not.toContain("Accommodation");
    expect(reply).not.toContain("我可以帮你总结");
  });

  it("does not fall back to seeded examples when matching mail is read", () => {
    const reply = fallbackChatReply("总结今天未读的重要邮件", "zh", [
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "Read but important",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: [],
        unread: false
      }
    ]);

    expect(reply).toContain("Read but important");
    expect(reply).not.toContain("OpenAI 邀请");
  });

  it("detects model replies that ignore provided inbox context", () => {
    expect(soundsLikeMissingMailboxAccess("我无法直接访问你的邮箱，请提供邮件内容。")).toBe(true);
    expect(soundsLikeMissingMailboxAccess("Important mail:\n- Google: security alert")).toBe(false);
  });

  it("routes inbox summary requests through local Gmail context", () => {
    expect(shouldAnswerFromInboxContext("总结今天未读的重要邮件")).toBe(true);
    expect(shouldAnswerFromInboxContext("Summarize important unread emails")).toBe(true);
    expect(shouldAnswerFromInboxContext("帮我写一封感谢邮件")).toBe(false);
  });

  it("uses full body content for fallback analysis when summary bullets are missing", () => {
    const [analysis] = fallbackAnalysis([
      {
        id: "gmail-1",
        senderName: "Angelos Stefanidis",
        senderEmail: "teacher@example.edu",
        subject: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
        snippet: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
        body: "DTS202TC Marking Review COMPLETED by Angelos Stefanidis. The marking review has been completed. Please check the course announcement for the reviewed marking outcome.",
        dateLabel: "今天",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: []
      }
    ]);

    expect(analysis.summaryBullets[0]).toContain("marking review has been completed");
  });

  it("aborts slow ChatAnywhere requests so chat can fall back", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));

    const request = callChatAnywhere({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hello" }],
      timeoutMs: 50
    });
    const expectation = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(50);

    await expectation;
    expect(global.fetch.mock.calls[0][1].signal).toBeTruthy();
  });

  it("retries ChatAnywhere with a backup API key when the primary key is quota limited", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "The free account is limited to 200 requests per day. Please try again after 00:00 the next day."
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "AI_OK" } }]
        })
      });

    const reply = await callChatAnywhere({
      providers: [
        { apiKey: "primary-key", baseUrl: "https://example.test/v1", model: "gpt-5-mini" },
        { apiKey: "backup-key", baseUrl: "https://example.test/v1", model: "gemini-3-flash" }
      ],
      messages: [{ role: "user", content: "hello" }]
    });

    expect(reply).toBe("AI_OK");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer primary-key");
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer backup-key");
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe("gpt-5-mini");
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).model).toBe("gemini-3-flash");
  });

  it("retries ChatAnywhere with a backup provider when the primary provider times out", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn()
      .mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "BACKUP_OK" } }]
        })
      });

    const request = callChatAnywhere({
      providers: [
        { apiKey: "primary-key", baseUrl: "https://example.test/v1", model: "gemini-3-flash" },
        { apiKey: "backup-key", baseUrl: "https://example.test/v1", model: "gpt-5-mini" }
      ],
      messages: [{ role: "user", content: "hello" }],
      timeoutMs: 50
    });
    await vi.advanceTimersByTimeAsync(50);

    await expect(request).resolves.toBe("BACKUP_OK");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).model).toBe("gpt-5-mini");
  });
});
