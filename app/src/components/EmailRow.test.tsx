import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Email } from "../types";
import { EmailRow } from "./EmailRow";

function email(patch: Partial<Email> = {}): Email {
  return {
    id: "mail",
    senderName: "spam-adm",
    senderEmail: "spam@example.com",
    subject: "Quarantine Summary",
    snippet: "One message quarantined",
    body: "One message quarantined",
    dateLabel: "5/2",
    fallbackCategoryId: "others",
    fallbackCategoryIds: ["others"],
    priority: "medium",
    summaryBullets: ["One message quarantined"],
    ...patch
  };
}

describe("EmailRow", () => {
  it("shows a blue unread dot for unread messages", () => {
    render(<EmailRow email={email({ unread: true })} language="zh" onOpen={vi.fn()} />);

    expect(screen.getByLabelText("未读邮件")).toBeTruthy();
  });

  it("does not show the unread dot for read messages", () => {
    render(<EmailRow email={email({ unread: false })} language="zh" onOpen={vi.fn()} />);

    expect(screen.queryByLabelText("未读邮件")).toBeNull();
  });
});
