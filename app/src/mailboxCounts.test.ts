import { describe, expect, it } from "vitest";
import { computeMailboxCounts, computeUnreadInboxCount, mailboxItemsForView } from "./mailboxCounts";
import type { Email } from "./types";

function email(id: string, patch: Partial<Email> = {}): Email {
  return {
    id,
    senderName: "Sender",
    senderEmail: "sender@example.com",
    subject: id,
    snippet: id,
    body: id,
    dateLabel: "今天",
    fallbackCategoryId: "others",
    fallbackCategoryIds: ["others"],
    priority: "medium",
    summaryBullets: [id],
    ...patch
  };
}

describe("mailbox counts", () => {
  it("counts folders from real message state instead of seeded labels", () => {
    const sourceEmails = [
      email("inbox"),
      email("starred", { starred: true }),
      email("snoozed", { archived: true, snoozed: true }),
      email("archived", { archived: true }),
      email("trash", { deleted: true }),
      email("spam", { spam: true }),
      email("draft", { draft: true }),
      email("sent-source", { sent: true })
    ];
    const sentEmails = [email("local-sent", { sent: true })];

    expect(computeMailboxCounts(sourceEmails, sentEmails)).toEqual({
      inbox: 2,
      all: 5,
      starred: 1,
      snoozed: 1,
      drafts: 1,
      sent: 2,
      archive: 2,
      spam: 1,
      trash: 1
    });
    expect(mailboxItemsForView("drafts", sourceEmails, sentEmails).map((item) => item.id)).toEqual(["draft"]);
  });

  it("counts inbox badges from unread messages only", () => {
    const sourceEmails = [
      email("unread", { unread: true }),
      email("unknown"),
      email("read", { unread: false }),
      email("archived", { archived: true, unread: true }),
      email("trash", { deleted: true, unread: true })
    ];

    expect(computeUnreadInboxCount(sourceEmails)).toBe(2);
  });
});
