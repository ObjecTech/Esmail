import { describe, expect, it } from "vitest";
import { applySortRules } from "./rules";
import type { Category, Email, SortRule } from "./types";

const categories: Category[] = [
  { id: "important", label: "重要", isDefault: true, color: "#52b7ff", order: 0 },
  { id: "student", label: "学生", isDefault: false, color: "#8cc8ff", order: 4 }
];

const email: Email = {
  id: "mail-1",
  senderName: "ENT208 Tutor",
  senderEmail: "tutor@student.edu",
  subject: "ENT208 feedback",
  snippet: "Please revise before Friday",
  body: "Please revise before Friday.",
  dateLabel: "今天",
  fallbackCategoryId: "important",
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
        categoryId: "student",
        field: "domain",
        operator: "contains",
        value: "student.edu",
        enabled: true
      }
    ];

    const [classified] = applySortRules([email], categories, rules);

    expect(classified.categoryId).toBe("student");
    expect(classified.matchedRuleId).toBe("rule-1");
  });

  it("falls back when a rule is disabled", () => {
    const rules: SortRule[] = [
      {
        id: "rule-1",
        categoryId: "student",
        field: "domain",
        operator: "contains",
        value: "student.edu",
        enabled: false
      }
    ];

    const [classified] = applySortRules([email], categories, rules);

    expect(classified.categoryId).toBe("important");
    expect(classified.matchedRuleId).toBeUndefined();
  });
});
