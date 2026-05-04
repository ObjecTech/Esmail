export const CATEGORY_DEFINITIONS = [
  { id: "course", label: "Course" },
  { id: "deadline", label: "Deadline" },
  { id: "university-notice", label: "University Notice" },
  { id: "career-internship", label: "Career / Internship" },
  { id: "system-notification", label: "System Notification" },
  { id: "others", label: "Others" }
];

export const CATEGORY_IDS = CATEGORY_DEFINITIONS.map((category) => category.id);

const UNIVERSITY_SENDER_TERMS = [
  "museum",
  "sa office",
  "scc",
  "mitsnotice",
  "lifelonglearning",
  "xipu insititution",
  "lib",
  "liverpool",
  "universitycommunications",
  "aoa",
  "studyabroad"
];

const CAREER_SENDER_TERMS = [
  "xjtlu external mentor",
  "xjtlu career centre"
];

const DEADLINE_PATTERNS = [
  /\bdeadline\b/i,
  /\bdue\b/i,
  /\bdue date\b/i,
  /\bsubmit\b/i,
  /\bsubmission\b/i,
  /\bclosing date\b/i,
  /\bexpires?\b/i,
  /\bbefore\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[:.]\d{2}|\d{1,2}\s*(am|pm)?)/i,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[:.]\d{2}|\d{1,2}\s*(am|pm)?)/i,
  /截止/,
  /截止日期/,
  /到期/,
  /过期/,
  /最晚/,
  /提交/,
  /之前/,
  /\bddl\b/i
];

const COURSE_CODE_PATTERN = /\b[A-Z]{3}\d{3}[A-Z]{0,3}\b/i;

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function containsAny(value, terms) {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

export function normalizeCategoryIds(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = values.map((item) => String(item).trim()).filter((item) => CATEGORY_IDS.includes(item));
  return unique(normalized);
}

export function primaryCategoryId(categoryIds = []) {
  const normalized = normalizeCategoryIds(categoryIds);
  return normalized[0] || "others";
}

export function classifyEmailText({ from = "", subject = "", snippet = "", body = "" } = {}) {
  const text = `${from} ${subject} ${snippet} ${body}`;
  const matched = [];

  if (COURSE_CODE_PATTERN.test(text)) matched.push("course");
  if (DEADLINE_PATTERNS.some((pattern) => pattern.test(text))) matched.push("deadline");
  if (containsAny(from, UNIVERSITY_SENDER_TERMS)) matched.push("university-notice");
  if (containsAny(from, CAREER_SENDER_TERMS)) matched.push("career-internship");
  if (/do not reply/i.test(text)) matched.push("system-notification");

  return matched.length ? unique(matched) : ["others"];
}

export function priorityForCategories(categoryIds = [], text = "") {
  const normalized = normalize(text);
  const ids = normalizeCategoryIds(categoryIds);
  if (ids.includes("deadline")) return "high";
  if (/\burgent\b|as soon as possible|immediately|重要|紧急|尽快/.test(normalized)) return "high";
  if (ids.includes("system-notification") || ids.includes("others")) return "low";
  return "medium";
}
