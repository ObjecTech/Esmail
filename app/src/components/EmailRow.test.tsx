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

  it("does not repeat the subject as the snippet when no todo exists", () => {
    render(<EmailRow email={email({ subject: "Repeated Subject", snippet: "Repeated Subject" })} language="zh" onOpen={vi.fn()} />);

    expect(screen.getAllByText("Repeated Subject")).toHaveLength(1);
  });

  it("uses the avatar slot as the selected checkmark in selection mode", () => {
    render(<EmailRow email={email()} isSelected isSelectionMode language="zh" onOpen={vi.fn()} />);

    expect(screen.getByLabelText("已选择邮件")).toBeTruthy();
  });
});
