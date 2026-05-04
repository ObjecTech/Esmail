import { describe, expect, it } from "vitest";
import { applyCustomViewFilters, visibleCategoriesForView } from "./customView";
import type { Category, CustomViewSettings, Email } from "./types";

const categories: Category[] = [
  { id: "course", label: "Course", isDefault: true, color: "#3f8cff", order: 0 },
  { id: "deadline", label: "Deadline", isDefault: true, color: "#d9972f", order: 1 },
  { id: "others", label: "Others", isDefault: true, color: "#8f95a3", order: 2 }
];

function email(overrides: Partial<Email>): Email {
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
    ...overrides
  };
}

describe("custom view helpers", () => {
  it("hides unchecked categories from the inbox tab list", () => {
    const visible = visibleCategoriesForView(categories, ["course", "others"]);

    expect(visible.map((category) => category.id)).toEqual(["course", "others"]);
  });

  it("filters unread mail after a message read state changes", () => {
    const settings: CustomViewSettings = {
      visibleCategoryIds: categories.map((category) => category.id),
      activeFilters: ["unread"],
      dateFilter: "all"
    };

    const result = applyCustomViewFilters(
      [
        email({ id: "read", unread: false }),
        email({ id: "unread", unread: true }),
        email({ id: "unknown" })
      ],
      settings,
      "me@example.com",
      new Date("2026-05-03T12:00:00+08:00")
    );

    expect(result.map((item) => item.id)).toEqual(["unread", "unknown"]);
  });

  it("matches recipient, cc, attachment, and date filters", () => {
    const settings: CustomViewSettings = {
      visibleCategoryIds: categories.map((category) => category.id),
      activeFilters: ["sentToMe", "ccMe", "attachments"],
      dateFilter: "sevenDays"
    };

    const result = applyCustomViewFilters(
      [
        email({
          id: "match",
          to: "Student <me@example.com>",
          cc: "Tutor <me@example.com>",
          hasAttachments: true,
          dateLabel: "4/30"
        }),
        email({
          id: "old",
          to: "Student <me@example.com>",
          cc: "Tutor <me@example.com>",
          hasAttachments: true,
          dateLabel: "4/20"
        }),
        email({
          id: "no-cc",
          to: "Student <me@example.com>",
          hasAttachments: true,
          dateLabel: "4/30"
        })
      ],
      settings,
      "me@example.com",
      new Date("2026-05-03T12:00:00+08:00")
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });
});
