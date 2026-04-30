import type { Category, Email, SortRule } from "./types";

export const defaultCategories: Category[] = [
  { id: "important", label: "重要", isDefault: true, color: "#52b7ff", order: 0 },
  { id: "thinking", label: "思考", isDefault: true, color: "#d8c16a", order: 1 },
  { id: "activity", label: "活动", isDefault: true, color: "#9b8cff", order: 2 },
  { id: "marketing", label: "营销", isDefault: true, color: "#f0769f", order: 3 },
  { id: "student", label: "学生", isDefault: false, color: "#8cc8ff", order: 4 }
];

export const initialRules: SortRule[] = [
  {
    id: "rule-student-domain",
    categoryId: "student",
    field: "domain",
    operator: "contains",
    value: "student.edu",
    enabled: true
  },
  {
    id: "rule-activity-subject",
    categoryId: "activity",
    field: "subject",
    operator: "contains",
    value: "workshop",
    enabled: true
  }
];

export const mockEmails: Email[] = [
  {
    id: "openai-invite",
    senderName: "OpenAI",
    senderEmail: "karen@openai.com",
    subject: "Karen Brown 已邀请你使用 ChatGPT Business",
    snippet: "Karen Brown 邀请你加入名为 OAI 的 ChatGPT Business 工作空间。",
    body: "Karen Brown 邀请你在工作空间 OAI 中使用 ChatGPT Business 参与协作。请点击邀请链接，并使用当前邮箱地址接受邀请。如有疑问，可通过邮件中的帮助中心联系支持团队。",
    dateLabel: "昨天",
    fallbackCategoryId: "important",
    priority: "high",
    summaryBullets: ["邀请你加入 OAI 工作空间。", "需要用当前邮箱接受邀请。", "有问题可联系支持团队。"],
    aiAction: {
      mode: "automatic",
      title: "接受加入 OAI ChatGPT Business 工作空间的邀请"
    }
  },
  {
    id: "ent208-feedback",
    senderName: "ENT208 Tutor",
    senderEmail: "feedback@student.edu",
    subject: "ENT208 technical document feedback",
    snippet: "Please revise the validation section before Friday.",
    body: "Please revise the validation section before Friday and include a clearer comparison between expected and observed outcomes.",
    dateLabel: "今天",
    fallbackCategoryId: "important",
    priority: "high",
    summaryBullets: ["技术文档需要补充验证部分。", "截止时间是周五前。"],
    aiAction: {
      mode: "automatic",
      title: "周五前修订 ENT208 技术文档验证部分"
    }
  },
  {
    id: "spark-login",
    senderName: "Spark",
    senderEmail: "security@sparkmailapp.com",
    subject: "New email account login in Spark",
    snippet: "Your email was used to sign in to Spark on an iPhone 14 Pro.",
    body: "Your email account was used to sign in to Spark on an iPhone 14 Pro. If this was you, no action is required.",
    dateLabel: "4月21日",
    fallbackCategoryId: "important",
    priority: "medium",
    summaryBullets: ["有一次新的 Spark 登录。", "如果是本人操作，无需处理。"]
  },
  {
    id: "web3-confirmation",
    senderName: "Web3 Jobs",
    senderEmail: "hello@web3jobs.io",
    subject: "Confirmation instructions",
    snippet: "请点击链接确认您的 Web3 Jobs 账户邮箱。",
    body: "请点击链接确认您的 Web3 Jobs 账户邮箱。确认后即可接收职位提醒。",
    dateLabel: "4月17日",
    fallbackCategoryId: "thinking",
    priority: "medium",
    summaryBullets: ["需要确认 Web3 Jobs 邮箱。", "确认后会接收职位提醒。"],
    aiAction: {
      mode: "suggested",
      title: "确认 Web3 Jobs 账户邮箱"
    }
  },
  {
    id: "campus-workshop",
    senderName: "XJTLU Career Centre",
    senderEmail: "career@xjtlu.edu.cn",
    subject: "AI product workshop this Thursday",
    snippet: "Register for the AI product workshop before seats are full.",
    body: "The AI product workshop will be held this Thursday. Seats are limited, and registration closes tomorrow at noon.",
    dateLabel: "今天",
    fallbackCategoryId: "activity",
    priority: "medium",
    summaryBullets: ["周四有 AI 产品工作坊。", "报名明天中午截止。"],
    aiAction: {
      mode: "suggested",
      title: "报名周四 AI 产品工作坊"
    }
  },
  {
    id: "google-security",
    senderName: "Google",
    senderEmail: "no-reply@accounts.google.com",
    subject: "安全提醒",
    snippet: "Security alert: You granted Esmail access to your Google Account data.",
    body: "You granted Esmail access to your Google Account data. Review permissions if this was not expected.",
    dateLabel: "昨天",
    fallbackCategoryId: "important",
    priority: "medium",
    summaryBullets: ["Esmail 获得 Google 账号访问权限。", "如非本人操作，请检查授权。"]
  },
  {
    id: "notion-marketing",
    senderName: "Notion",
    senderEmail: "team@mail.notion.so",
    subject: "New templates for your team",
    snippet: "Try planning templates for projects, notes, and coursework.",
    body: "Explore new templates for projects, notes, coursework and team planning.",
    dateLabel: "最近 7 天",
    fallbackCategoryId: "marketing",
    priority: "low",
    summaryBullets: ["Notion 推送新模板。", "无需立即处理。"]
  },
  {
    id: "recruitment-code",
    senderName: "Recruitment Assistant",
    senderEmail: "verify@jobs.example.com",
    subject: "One-time verification code",
    snippet: "Verification code: 182126",
    body: "Your one-time verification code is 182126. It expires in 10 minutes.",
    dateLabel: "4月17日",
    fallbackCategoryId: "thinking",
    priority: "low",
    summaryBullets: ["一次性验证码。", "仅在登录时需要。"]
  }
];
