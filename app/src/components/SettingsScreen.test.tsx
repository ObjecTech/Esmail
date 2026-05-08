import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCategories } from "../mockData";
import type { SortRule } from "../types";
import { SettingsScreen } from "./SettingsScreen";

const rule: SortRule = {
  id: "rule-chaoqun",
  categoryId: "course",
  field: "sender",
  operator: "contains",
  value: "Chaoqun Wang",
  enabled: true
};

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const props: React.ComponentProps<typeof SettingsScreen> = {
    categories: defaultCategories,
    language: "zh",
    mode: "customView",
    rules: [rule],
    onAddCategory: vi.fn(),
    onAddRule: vi.fn(),
    onBack: vi.fn(),
    onDeleteRule: vi.fn(),
    onViewSettingsChange: vi.fn(),
    viewSettings: {
      visibleCategoryIds: defaultCategories.map((category) => category.id),
      activeFilters: [],
      dateFilter: "all"
    },
    ...overrides
  };

  render(<SettingsScreen {...props} />);
  return props;
}

describe("SettingsScreen", () => {
  it("opens the smart label form with empty fields and placeholder guidance", () => {
    renderSettings({ mode: "smartLabel" });

    const labelInput = screen.getByPlaceholderText("输入你喜欢的标签名称");
    const hintInput = screen.getByPlaceholderText("详细描述哪些邮件符合此标签，以帮助 Esmail AI 更智能地工作。");

    expect((labelInput as HTMLInputElement).value).toBe("");
    expect((hintInput as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("0/30")).toBeTruthy();
    expect(screen.getByText("0/100")).toBeTruthy();
  });

  it("toggles filter conditions and updates the date filter", () => {
    const props = renderSettings();

    const unreadFilter = screen.getByRole("button", { name: "未读" });
    expect(unreadFilter.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(unreadFilter);
    expect(props.onViewSettingsChange).toHaveBeenCalledWith({
      visibleCategoryIds: defaultCategories.map((category) => category.id),
      activeFilters: ["unread"],
      dateFilter: "all"
    });

    fireEvent.click(screen.getByRole("button", { name: /日期 所有日期/ }));
    fireEvent.click(screen.getByRole("button", { name: "今天" }));

    expect(props.onViewSettingsChange).toHaveBeenLastCalledWith({
      visibleCategoryIds: defaultCategories.map((category) => category.id),
      activeFilters: [],
      dateFilter: "today"
    });
  });

  it("reports category visibility changes to the custom view", () => {
    const props = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "课程" }));

    expect(props.onViewSettingsChange).toHaveBeenCalledWith({
      visibleCategoryIds: defaultCategories.filter((category) => category.id !== "course").map((category) => category.id),
      activeFilters: [],
      dateFilter: "all"
    });
  });

  it("deletes an existing rule from the current rules list", () => {
    const props = renderSettings();
    const ruleRow = screen.getByText("发送者 包含 “Chaoqun Wang”").closest(".rule-row");
    expect(ruleRow).toBeTruthy();

    fireEvent.click(within(ruleRow as HTMLElement).getByRole("button", { name: /删除规则/ }));

    expect(props.onDeleteRule).toHaveBeenCalledWith("rule-chaoqun");
  });
});
