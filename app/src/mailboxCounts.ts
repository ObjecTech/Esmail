import type { Email, MailboxView } from "./types";
import { isUnreadEmail } from "./mailState";

export type MailboxCounts = Record<MailboxView, number>;

function isTrash(email: Email) {
  return Boolean(email.deleted);
}

function isSpam(email: Email) {
  return Boolean(email.spam) && !isTrash(email);
}

function isDraft(email: Email) {
  return Boolean(email.draft) && !isTrash(email);
}

function isSent(email: Email) {
  return Boolean(email.sent) && !isTrash(email);
}

function isInbox(email: Email) {
  return !isTrash(email) && !email.archived && !isSpam(email) && !isDraft(email) && !isSent(email);
}

function isAllMail(email: Email) {
  return !isTrash(email) && !isSpam(email) && !isDraft(email);
}

export function mailboxItemsForView(view: MailboxView, sourceEmails: Email[], sentEmails: Email[] = []) {
  if (view === "sent") return [...sourceEmails.filter(isSent), ...sentEmails.filter((email) => !isTrash(email))];
  if (view === "all") return sourceEmails.filter(isAllMail);
  if (view === "starred") return sourceEmails.filter((email) => email.starred && isAllMail(email));
  if (view === "snoozed") return sourceEmails.filter((email) => email.snoozed && isAllMail(email));
  if (view === "trash") return sourceEmails.filter(isTrash);
  if (view === "archive") return sourceEmails.filter((email) => Boolean(email.archived) && isAllMail(email));
  if (view === "spam") return sourceEmails.filter(isSpam);
  if (view === "drafts") return sourceEmails.filter(isDraft);
  return sourceEmails.filter(isInbox);
}

export function computeMailboxCounts(sourceEmails: Email[], sentEmails: Email[] = []): MailboxCounts {
  return {
    inbox: mailboxItemsForView("inbox", sourceEmails, sentEmails).length,
    all: mailboxItemsForView("all", sourceEmails, sentEmails).length,
    starred: mailboxItemsForView("starred", sourceEmails, sentEmails).length,
    snoozed: mailboxItemsForView("snoozed", sourceEmails, sentEmails).length,
    drafts: mailboxItemsForView("drafts", sourceEmails, sentEmails).length,
    sent: mailboxItemsForView("sent", sourceEmails, sentEmails).length,
    archive: mailboxItemsForView("archive", sourceEmails, sentEmails).length,
    spam: mailboxItemsForView("spam", sourceEmails, sentEmails).length,
    trash: mailboxItemsForView("trash", sourceEmails, sentEmails).length
  };
}

export function computeUnreadInboxCount(sourceEmails: Email[]) {
  return mailboxItemsForView("inbox", sourceEmails).filter(isUnreadEmail).length;
}
