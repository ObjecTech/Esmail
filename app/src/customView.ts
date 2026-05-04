import type { Category, CustomViewSettings, Email } from "./types";
import { isUnreadEmail } from "./mailState";

const dayMs = 24 * 60 * 60 * 1000;

export function defaultCustomViewSettings(categories: Category[]): CustomViewSettings {
  return {
    visibleCategoryIds: categories.map((category) => category.id),
    activeFilters: [],
    dateFilter: "all"
  };
}

export function visibleCategoriesForView(categories: Category[], visibleCategoryIds: string[]) {
  const visible = new Set(visibleCategoryIds);
  return categories.filter((category) => visible.has(category.id));
}

export function applyCustomViewFilters(
  emails: Email[],
  settings: CustomViewSettings,
  accountEmail = "",
  now = new Date()
) {
  return emails.filter((email) => {
    if (!matchesDateFilter(email, settings.dateFilter, now)) return false;
    return settings.activeFilters.every((filter) => {
      if (filter === "unread") return isUnreadEmail(email);
      if (filter === "sentToMe") return isSentToMe(email, accountEmail);
      if (filter === "ccMe") return containsAddress(email.cc, accountEmail);
      return Boolean(email.hasAttachments || email.images?.length);
    });
  });
}

function isSentToMe(email: Email, accountEmail: string) {
  if (email.to) return containsAddress(email.to, accountEmail);
  return !email.sent;
}

function containsAddress(value = "", accountEmail: string) {
  const cleanAccount = accountEmail.trim().toLowerCase();
  if (!cleanAccount) return false;
  return value.toLowerCase().includes(cleanAccount);
}

function matchesDateFilter(email: Email, filter: CustomViewSettings["dateFilter"], now: Date) {
  if (filter === "all") return true;
  const parsed = dateFromLabel(email.dateLabel, now);
  if (!parsed) {
    if (filter === "today") return /^(今天|today|刚刚|now)$/i.test(email.dateLabel.trim());
    if (filter === "sevenDays") return /最近\s*7\s*天|last\s*7\s*days/i.test(email.dateLabel);
    return /最近\s*(7|30)\s*天|last\s*(7|30)\s*days/i.test(email.dateLabel);
  }

  const today = startOfDay(now);
  const diffDays = Math.floor((today.getTime() - startOfDay(parsed).getTime()) / dayMs);
  if (filter === "today") return diffDays === 0;
  if (filter === "sevenDays") return diffDays >= 0 && diffDays <= 7;
  return diffDays >= 0 && diffDays <= 30;
}

function dateFromLabel(label: string, now: Date) {
  const clean = label.trim().toLowerCase();
  if (/^(今天|today|刚刚|now)$/.test(clean)) return now;
  if (/^(昨天|yesterday)$/.test(clean)) return new Date(now.getTime() - dayMs);

  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  const zhMatch = clean.match(/^(\d{1,2})月(\d{1,2})日?$/);
  const match = slashMatch || zhMatch;
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const parsed = new Date(now.getFullYear(), month - 1, day);
  if (parsed.getTime() > now.getTime() + dayMs) {
    parsed.setFullYear(parsed.getFullYear() - 1);
  }
  return parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
