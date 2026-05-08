import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCategories } from "../mockData";
import type { AccountSession, Email } from "../types";
import { InboxScreen } from "./InboxScreen";

const session: AccountSession = {
  authenticated: true,
  provider: "google",
  email: "student@example.com",
  name: "Student"
};

function email(patch: Partial<Email> = {}): Email {
  return {
    id: "mail-1",
    senderName: "Registry",
    senderEmail: "registry@example.com",
    subject: "Exam timetable",
    snippet: "Final exam timetable has been published.",
    body: "Final exam timetable has been published.",
    dateLabel: "5/5",
    fallbackCategoryId: "deadline",
    fallbackCategoryIds: ["deadline"],
    priority: "medium",
    summaryBullets: [],
    ...patch
  };
}

function renderInbox(overrides: Partial<React.ComponentProps<typeof InboxScreen>> = {}) {
  const props: React.ComponentProps<typeof InboxScreen> = {
    activeCategoryId: "all",
    categories: defaultCategories,
    emails: [email()],
    gmailError: "",
    gmailStatus: "loaded",
    language: "zh",
    mailboxTitle: "收件箱",
    searchQuery: "",
    session,
    showCategories: true,
    todos: [],
    onAddAccount: vi.fn(),
    onArchiveEmails: vi.fn(),
    onAssignCategory: vi.fn(),
    onCategoryChange: vi.fn(),
    onConnectGoogle: vi.fn(),
    onDeleteEmails: vi.fn(),
    onLogoutAccount: vi.fn(),
    onMarkReadEmails: vi.fn(),
    onOpenEmail: vi.fn(),
    onOpenMenu: vi.fn(),
    onOpenSettings: vi.fn(),
    onSearchChange: vi.fn(),
    ...overrides
  };

  render(<InboxScreen {...props} />);
  return props;
}

describe("InboxScreen", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function longPressFirstEmail() {
    vi.useFakeTimers();
    const row = screen.getByText("Exam timetable").closest("button");
    expect(row).toBeTruthy();

    fireEvent.pointerDown(row as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(row as HTMLElement);
  }

  it("removes the standalone today group and enters multi-select by long pressing an email", () => {
    const props = renderInbox({
      emails: [
        email({ id: "mail-1", subject: "Exam timetable" }),
        email({ id: "mail-2", subject: "Library workshop", senderName: "Library" })
      ]
    });

    expect(screen.queryByText("今天")).toBeNull();
    expect(screen.queryByRole("button", { name: "批量处理" })).toBeNull();

    longPressFirstEmail();

    expect(screen.getByLabelText("已选择 1 封邮件")).toBeTruthy();
    expect(screen.getByRole("button", { name: "归档" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "删除" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "一键已读" })).toBeTruthy();
    expect(screen.getAllByLabelText("已选择邮件")).toHaveLength(1);

    fireEvent.click(screen.getByText("Library workshop").closest("button") as HTMLElement);
    expect(screen.getByLabelText("已选择 2 封邮件")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    expect(props.onArchiveEmails).toHaveBeenCalledWith(["mail-1", "mail-2"]);
  });

  it("shows category choices from the more menu and assigns selected emails", () => {
    const props = renderInbox();

    longPressFirstEmail();
    fireEvent.click(screen.getByRole("button", { name: "更多操作" }));

    const menu = screen.getByRole("dialog", { name: "智能标签" });
    fireEvent.click(within(menu).getByRole("button", { name: "课程" }));

    expect(props.onAssignCategory).toHaveBeenCalledWith(["mail-1"], "course");
  });
});
