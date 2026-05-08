export type Priority = "high" | "medium" | "low";
export type AiActionMode = "automatic" | "suggested";
export type TodoStatus = "active" | "completed";
export type RuleField = "domain" | "sender" | "subject" | "content";
export type RuleOperator = "contains";
export type Screen = "inbox" | "todos" | "ai" | "settings";
export type Language = "zh" | "en";
export type Theme = "white" | "morandi";
export type SettingsMode = "customView" | "smartLabel";
export type MailboxView = "inbox" | "all" | "starred" | "snoozed" | "drafts" | "sent" | "archive" | "spam" | "trash";
export type CustomViewFilterKey = "unread" | "sentToMe" | "ccMe" | "attachments";
export type CustomViewDateFilter = "all" | "today" | "sevenDays" | "thirtyDays";

export interface CustomViewSettings {
  visibleCategoryIds: string[];
  activeFilters: CustomViewFilterKey[];
  dateFilter: CustomViewDateFilter;
}

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
  htmlBody?: string;
  to?: string;
  cc?: string;
  dateLabel: string;
  fallbackCategoryId: string;
  fallbackCategoryIds?: string[];
  categoryId?: string;
  categoryIds?: string[];
  priority: Priority;
  summaryBullets: string[];
  images?: EmailImage[];
  aiAction?: AiAction;
  matchedRuleId?: string;
  matchedRuleIds?: string[];
  starred?: boolean;
  archived?: boolean;
  deleted?: boolean;
  draft?: boolean;
  sent?: boolean;
  spam?: boolean;
  snoozed?: boolean;
  unread?: boolean;
  hasAttachments?: boolean;
  fullLoaded?: boolean;
  summaryGenerated?: boolean;
  summaryLanguage?: Language;
}

export interface EmailImage {
  filename: string;
  mimeType: string;
  contentId?: string;
  disposition?: string;
  dataUrl: string;
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

export interface EmailCitation {
  email: Email;
  score: number;
  matchLabel: string;
  excerpt: string;
  summaryBullets: string[];
  categoryIds: string[];
}

export interface AiChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: AssistantReply;
  citations?: EmailCitation[];
  showMoreSearch?: boolean;
  createdAt: number;
}

export interface AiConversation {
  id: string;
  title: string;
  messages: AiChatMessage[];
  updatedAt: number;
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
  categoryIds?: string[];
}
