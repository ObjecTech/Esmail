import { describe, expect, it } from "vitest";
import { applySortRules } from "./rules";
import type { Category, Email, SortRule } from "./types";

const categories: Category[] = [
  { id: "course", label: "Course", isDefault: true, color: "#3f8cff", order: 0 },
  { id: "deadline", label: "Deadline", isDefault: true, color: "#d9972f", order: 1 },
  { id: "others", label: "Others", isDefault: true, color: "#8f95a3", order: 2 }
];

const email: Email = {
  id: "mail-1",
  senderName: "ENT208 Tutor",
  senderEmail: "tutor@student.edu",
  subject: "ENT208 feedback",
  snippet: "Please revise before Friday",
  body: "Please revise before Friday.",
  dateLabel: "今天",
  fallbackCategoryId: "deadline",
  fallbackCategoryIds: ["deadline"],
  priority: "high",
  summaryBullets: ["需要周五前修订。"],
  aiAction: {
    mode: "automatic",
    title: "周五前提交 ENT208 修订版"
  }
};

describe("applySortRules", () => {
  it("classifies emails by sender domain rules", () => {
    const rules: SortRule[] = [
      {
        id: "rule-1",
        categoryId: "course",
        field: "domain",
        operator: "contains",
        value: "student.edu",
        enabled: true
      }
    ];

    const [classified] = applySortRules([email], categories, rules);

    expect(classified.categoryId).toBe("course");
    expect(classified.categoryIds).toEqual(expect.arrayContaining(["course", "deadline"]));
    expect(classified.matchedRuleId).toBe("rule-1");
  });

  it("falls back when a rule is disabled", () => {
    const rules: SortRule[] = [
      {
        id: "rule-1",
        categoryId: "course",
        field: "domain",
        operator: "contains",
        value: "student.edu",
        enabled: false
      }
    ];

    const [classified] = applySortRules([email], categories, rules);

    expect(classified.categoryId).toBe("deadline");
    expect(classified.matchedRuleId).toBeUndefined();
  });
});
