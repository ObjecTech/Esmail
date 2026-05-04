import type { Email } from "./types";

export function isUnreadEmail(email: Email) {
  return email.unread !== false;
}
