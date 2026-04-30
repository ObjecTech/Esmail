import type { Category, Language } from "./types";

export type TextKey =
  | "activity"
  | "add"
  | "allInbox"
  | "allMail"
  | "allSelect"
  | "applyRecent"
  | "attachments"
  | "ccMe"
  | "completed"
  | "customLabelPage"
  | "customView"
  | "date"
  | "delete"
  | "drafts"
  | "edit"
  | "esmailMail"
  | "filters"
  | "important"
  | "inbox"
  | "language"
  | "marketing"
  | "markDone"
  | "name"
  | "newRule"
  | "rules"
  | "search"
  | "sentToMe"
  | "starred"
  | "student"
  | "thinking"
  | "todos"
  | "unread";

const dictionary: Record<Language, Record<TextKey, string>> = {
  zh: {
    activity: "活动",
    add: "添加",
    allInbox: "所有收件箱",
    allMail: "所有邮件",
    allSelect: "全选",
    applyRecent: "应用到最近50封邮件",
    attachments: "带附件",
    ccMe: "抄送给我",
    completed: "查看完成项",
    customLabelPage: "自定义标签页",
    customView: "自定义视图",
    date: "日期",
    delete: "删除",
    drafts: "草稿",
    edit: "编辑",
    esmailMail: "Esmail邮箱",
    filters: "筛选条件",
    important: "重要",
    inbox: "收件箱",
    language: "语言",
    marketing: "营销",
    markDone: "标记完成",
    name: "名称",
    newRule: "新增规则",
    rules: "分类规则",
    search: "搜索",
    sentToMe: "发给我",
    starred: "已加星标",
    student: "学生",
    thinking: "思考",
    todos: "待办事项",
    unread: "未读"
  },
  en: {
    activity: "Activity",
    add: "Add",
    allInbox: "All Inboxes",
    allMail: "All Mail",
    allSelect: "Select All",
    applyRecent: "Apply to latest 50 emails",
    attachments: "Has attachments",
    ccMe: "Cc me",
    completed: "Completed",
    customLabelPage: "Custom labels",
    customView: "Custom View",
    date: "Date",
    delete: "Delete",
    drafts: "Drafts",
    edit: "Edit",
    esmailMail: "Esmail Mail",
    filters: "Filters",
    important: "Important",
    inbox: "Inbox",
    language: "Language",
    marketing: "Marketing",
    markDone: "Mark Done",
    name: "Name",
    newRule: "New Rule",
    rules: "Sort Rules",
    search: "Search",
    sentToMe: "Sent to me",
    starred: "Starred",
    student: "Student",
    thinking: "Thinking",
    todos: "Todos",
    unread: "Unread"
  }
};

export function text(language: Language, key: TextKey) {
  return dictionary[language][key];
}

export function categoryLabel(category: Category, language: Language) {
  if (category.id === "important") return text(language, "important");
  if (category.id === "thinking") return text(language, "thinking");
  if (category.id === "activity") return text(language, "activity");
  if (category.id === "marketing") return text(language, "marketing");
  if (category.id === "student") return text(language, "student");
  return category.label;
}
