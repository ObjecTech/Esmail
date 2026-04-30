import type { Category, Email, RuleField, SortRule } from "./types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function valueForField(email: Email, field: RuleField) {
  if (field === "domain") {
    return email.senderEmail.split("@")[1] || email.senderEmail;
  }
  if (field === "sender") {
    return `${email.senderName} ${email.senderEmail}`;
  }
  if (field === "subject") {
    return email.subject;
  }
  return `${email.snippet} ${email.body}`;
}

function categoryExists(categories: Category[], categoryId: string) {
  return categories.some((category) => category.id === categoryId);
}

function matchesRule(email: Email, rule: SortRule) {
  return normalize(valueForField(email, rule.field)).includes(normalize(rule.value));
}

export function applySortRules(
  emails: Email[],
  categories: Category[],
  rules: SortRule[]
) {
  const activeRules = rules.filter((rule) => rule.enabled && categoryExists(categories, rule.categoryId));

  return emails.map((email) => {
    const matchedRule = activeRules.find((rule) => matchesRule(email, rule));
    return {
      ...email,
      categoryId: matchedRule?.categoryId ?? email.fallbackCategoryId,
      matchedRuleId: matchedRule?.id
    };
  });
}
