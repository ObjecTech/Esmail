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

export function emailCategoryIds(email: Email) {
  const ids = [
    ...(email.categoryIds || []),
    ...(email.fallbackCategoryIds || []),
    email.categoryId,
    email.fallbackCategoryId
  ].filter(Boolean) as string[];
  return [...new Set(ids)];
}

export function applySortRules(
  emails: Email[],
  categories: Category[],
  rules: SortRule[]
) {
  const activeRules = rules.filter((rule) => rule.enabled && categoryExists(categories, rule.categoryId));

  return emails.map((email) => {
    const matchedRules = activeRules.filter((rule) => matchesRule(email, rule));
    const categoryIds = [...new Set([
      ...matchedRules.map((rule) => rule.categoryId),
      ...emailCategoryIds(email)
    ].filter((categoryId) => categoryExists(categories, categoryId)))];
    const primaryCategoryId = categoryIds[0] || email.fallbackCategoryId;
    return {
      ...email,
      categoryIds,
      categoryId: primaryCategoryId,
      matchedRuleId: matchedRules[0]?.id,
      matchedRuleIds: matchedRules.map((rule) => rule.id)
    };
  });
}
