export type Priority = "high" | "medium" | "low";
export type AiActionMode = "automatic" | "suggested";
export type TodoStatus = "active" | "completed";
export type RuleField = "domain" | "sender" | "subject" | "content";
export type RuleOperator = "contains";
export type Screen = "inbox" | "todos" | "ai" | "settings";
export type Language = "zh" | "en";
export type SettingsMode = "customView" | "smartLabel";
export type MailboxView = "inbox" | "all" | "starred" | "snoozed" | "drafts" | "sent" | "archive" | "spam" | "trash";

export interface AiAction {
  mode: AiActionMode;
  title: string;
}

export interface Email {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body: string;
  dateLabel: string;
  fallbackCategoryId: string;
  categoryId?: string;
  priority: Priority;
  summaryBullets: string[];
  aiAction?: AiAction;
  matchedRuleId?: string;
  starred?: boolean;
  archived?: boolean;
  deleted?: boolean;
  snoozed?: boolean;
  unread?: boolean;
}

export interface Todo {
  id: string;
  emailId: string;
  title: string;
  source: string;
  status: TodoStatus;
  createdMode: AiActionMode;
  createdAtLabel: string;
}

export interface Category {
  id: string;
  label: string;
  isDefault: boolean;
  color: string;
  order: number;
}

export interface SortRule {
  id: string;
  categoryId: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
  enabled: boolean;
}

export interface AssistantReply {
  title: string;
  lines: string[];
}

export interface Draft {
  subject: string;
  body: string;
}

export interface AccountSession {
  authenticated: boolean;
  provider?: "google" | "qq";
  email?: string;
  name?: string;
  picture?: string;
}

export interface InboxAnalysis {
  id: string;
  summaryBullets: string[];
  todoTitle?: string;
  categoryId?: string;
}
