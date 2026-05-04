import { describe, expect, it } from "vitest";
import { isUnreadEmail } from "./mailState";
import type { Email } from "./types";

function email(patch: Partial<Email> = {}): Email {
  return {
    id: "mail",
    senderName: "Sender",
    senderEmail: "sender@example.com",
    subject: "Subject",
    snippet: "Snippet",
    body: "Body",
    dateLabel: "今天",
    fallbackCategoryId: "others",
    fallbackCategoryIds: ["others"],
    priority: "medium",
    summaryBullets: ["Summary"],
    ...patch
  };
}

describe("mail state", () => {
  it("treats only explicitly read mail as read", () => {
    expect(isUnreadEmail(email({ unread: true }))).toBe(true);
    expect(isUnreadEmail(email())).toBe(true);
    expect(isUnreadEmail(email({ unread: false }))).toBe(false);
  });
});
