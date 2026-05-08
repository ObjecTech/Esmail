import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCategories } from "../mockData";
import type { MailboxView, Theme } from "../types";
import { SideMenu } from "./SideMenu";

function renderMenu(mailboxCounts: Record<MailboxView, number>, overrides: { theme?: Theme; onToggleTheme?: () => void } = {}) {
  render(
    <SideMenu
      categories={defaultCategories}
      categoryCounts={{}}
      inboxCount={82}
      isOpen
      language="zh"
      mailboxCounts={mailboxCounts}
      mailboxView="drafts"
      theme={overrides.theme || "morandi"}
      onCategorySelect={vi.fn()}
      onClose={vi.fn()}
      onMailboxSelect={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenSmartLabel={vi.fn()}
      onToggleLanguage={vi.fn()}
      onToggleTheme={overrides.onToggleTheme || vi.fn()}
    />
  );
}

const mailboxCounts = {
  inbox: 82,
  all: 82,
  starred: 0,
  snoozed: 0,
  drafts: 0,
  sent: 0,
  archive: 0,
  spam: 0,
  trash: 0
};

describe("SideMenu", () => {
  it("does not show a draft count when there are no drafts", () => {
    renderMenu(mailboxCounts);

    expect(within(screen.getByRole("button", { name: "草稿" })).queryByText("1")).toBeNull();
  });

  it("shows the Morandi theme switch below language and calls the theme toggle", () => {
    const onToggleTheme = vi.fn();
    renderMenu(mailboxCounts, { onToggleTheme });

    const languageRow = screen.getByRole("button", { name: /语言/ });
    const themeRow = screen.getByRole("button", { name: /主题/ });

    expect(languageRow.compareDocumentPosition(themeRow)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(themeRow).getByText("Morandi")).toBeTruthy();

    themeRow.click();

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("labels the restored white theme in Chinese", () => {
    renderMenu(mailboxCounts, { theme: "white" });

    const themeRow = screen.getByRole("button", { name: /主题/ });

    expect(within(themeRow).getByText("白色")).toBeTruthy();
  });
});
