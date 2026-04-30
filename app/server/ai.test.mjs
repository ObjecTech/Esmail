import { describe, expect, it } from "vitest";
import { buildChatPayload, buildContextualChatPrompt, fallbackChatReply, shouldAnswerFromInboxContext, soundsLikeMissingMailboxAccess, summarizeAnalysisPrompt } from "./ai.mjs";

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

  it("asks the model for concise inbox analysis JSON", () => {
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
    expect(prompt).toContain("最多 3 条");
    expect(prompt).toContain("ENT208 feedback");
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

    expect(prompt).toContain("收件箱上下文");
    expect(prompt).toContain("ENT208 feedback");
    expect(prompt).toContain("用户问题");
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
});
