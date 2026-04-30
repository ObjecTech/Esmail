import { describe, expect, it } from "vitest";
import { generateDraft, getAssistantReply } from "./ai";

describe("mock AI helpers", () => {
  it("keeps assistant replies concise", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件");

    expect(reply.lines.length).toBeLessThanOrEqual(3);
  });

  it("generates an editable draft", () => {
    const draft = generateDraft("礼貌回复老师，说明我会在周五前提交", "中文", "专业");

    expect(draft.subject.length).toBeGreaterThan(0);
    expect(draft.body).toContain("周五前");
  });

  it("returns English assistant replies when the app language is English", () => {
    const reply = getAssistantReply("Summarize important unread emails", "en");

    expect(reply.title).toBe("Important unread");
    expect(reply.lines.join(" ")).toContain("OpenAI");
    expect(reply.lines.join(" ")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("uses provided emails for important mail summaries", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件", "zh", [
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

    expect(reply.title).toBe("重要邮件");
    expect(reply.lines[0]).toContain("ENT208 feedback");
  });

  it("summarizes important mail even when Gmail marks it as read", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件", "zh", [
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

    expect(reply.lines[0]).toContain("Read but important");
  });

  it("generates English drafts from the English app language", () => {
    const draft = generateDraft("politely reply and confirm I will submit before Friday", "en", "Professional");

    expect(draft.subject).toContain("Follow-up");
    expect(draft.body).toContain("before Friday");
    expect(draft.body).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
