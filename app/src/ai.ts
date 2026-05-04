import type { AssistantReply, Draft, Email, EmailCitation, Language } from "./types";
import { emailCategoryIds } from "./rules";

const intentTerms = {
  zh: {
    today: ["今天", "今日"],
    important: ["重要", "紧急", "截止", "待办"],
    unread: ["未读"],
    search: ["找", "查", "看到", "记得", "哪封", "邮件"]
  },
  en: {
    today: ["today"],
    important: ["important", "urgent", "deadline", "due", "todo", "action"],
    unread: ["unread"],
    search: ["find", "search", "saw", "remember", "email", "mail"]
  }
};

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ");
}

function promptTokens(prompt: string) {
  const normalized = normalizeText(prompt);
  const latinTokens = normalized.split(/\s+/).filter((token) => token.length >= 2);
  const cjkTokens = (prompt.match(/[\u4e00-\u9fff]{2,}/g) || []).flatMap((segment) => {
    const bigrams = Array.from({ length: Math.max(0, segment.length - 1) }, (_, index) => segment.slice(index, index + 2));
    return [segment, ...bigrams];
  });
  const semanticTokens: string[] = [];
  if (/[考试]/.test(prompt)) semanticTokens.push("exam", "final");
  if (prompt.includes("安排") || prompt.includes("日程") || prompt.includes("时间")) semanticTokens.push("schedule", "arrangement", "timetable");
  if (prompt.includes("王超群") || prompt.includes("超群")) semanticTokens.push("chaoqun", "wang");
  return Array.from(new Set([...latinTokens, ...cjkTokens, ...semanticTokens]));
}

function includesAny(prompt: string, terms: string[]) {
  const normalized = prompt.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function relevantText(email: Email) {
  return [
    email.senderName,
    email.senderEmail,
    email.subject,
    email.snippet,
    email.body,
    email.dateLabel,
    email.categoryId,
    email.fallbackCategoryId,
    ...(email.categoryIds || []),
    ...(email.fallbackCategoryIds || []),
    ...(email.summaryBullets || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function excerptFor(email: Email, tokens: string[]) {
  const source = email.body || email.snippet || email.subject;
  if (source.length <= 180) return source;
  const normalizedSource = source.toLowerCase();
  const matched = tokens.find((token) => normalizedSource.includes(token.toLowerCase()));
  if (!matched) return (email.snippet || source).slice(0, 150);
  const index = normalizedSource.indexOf(matched.toLowerCase());
  const start = Math.max(0, index - 45);
  const end = Math.min(source.length, index + matched.length + 95);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function citationMatchPercent(score: number) {
  return Math.min(99, Math.round(score * 2.2));
}

export function isSearchLikePrompt(prompt: string, language: Language = "zh") {
  const terms = language === "en" ? intentTerms.en : intentTerms.zh;
  const normalized = prompt.toLowerCase();
  return (
    includesAny(prompt, terms.search) ||
    includesAny(prompt, terms.important) ||
    includesAny(prompt, terms.unread) ||
    normalized.includes("summary") ||
    normalized.includes("summarize")
  );
}

export function findRelevantEmailCitations(prompt: string, emails: Email[] = [], language: Language = "zh"): EmailCitation[] {
  const ignoredTokens = new Set([
    "邮件",
    "邮箱",
    "email",
    "mail",
    "看到",
    "之前",
    "帮我",
    "老师",
    "对于",
    "哪里",
    "xjtlu",
    "edu",
    "cn",
    "com",
    "org",
    "net"
  ]);
  const tokens = promptTokens(prompt).filter((token) => !ignoredTokens.has(token.toLowerCase()));
  const terms = language === "en" ? intentTerms.en : intentTerms.zh;
  const wantsToday = includesAny(prompt, terms.today);
  const wantsImportant = includesAny(prompt, terms.important);
  const wantsUnread = includesAny(prompt, terms.unread);
  const priorityScore = { high: 6, medium: 3, low: 0 };

  return emails
    .filter((email) => !email.deleted && !email.archived)
    .map((email) => {
      const categoryIds = emailCategoryIds(email);
      const haystack = normalizeText(relevantText(email));
      const tokenScore = tokens.reduce((score, token) => {
        const normalizedToken = normalizeText(token).trim();
        if (!normalizedToken) return score;
        if (!haystack.includes(normalizedToken)) return score;
        if (normalizeText(email.subject).includes(normalizedToken)) return score + 20;
        if (normalizeText(email.senderName).includes(normalizedToken) || normalizeText(email.senderEmail).includes(normalizedToken)) return score + 16;
        return score + 10;
      }, 0);
      const todayScore = wantsToday && ["今天", "today"].includes(String(email.dateLabel).toLowerCase()) ? 14 : 0;
      const importantScore = wantsImportant && (email.priority === "high" || categoryIds.includes("deadline")) ? 24 : 0;
      const unreadScore = wantsUnread && email.unread !== false ? 6 : 0;
      const intentScore = todayScore + importantScore + unreadScore;
      const categoryScore = intentScore || tokenScore ? (categoryIds.includes("deadline") ? 6 : categoryIds.includes("course") ? 5 : 0) : 0;
      const score = tokenScore + intentScore + categoryScore + (intentScore || tokenScore ? priorityScore[email.priority] : 0);
      const matchPercent = citationMatchPercent(score);

      return {
        email,
        score,
        matchLabel: language === "en" ? `${matchPercent}% match` : `${matchPercent}% 匹配`,
        excerpt: excerptFor(email, tokens),
        summaryBullets: email.summaryBullets?.length ? email.summaryBullets.slice(0, 3) : [email.snippet || email.subject],
        categoryIds
      };
    })
    .filter((citation) => citationMatchPercent(citation.score) >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function relevantEmails(prompt: string, emails: Email[]) {
  const normalized = prompt.toLowerCase();
  const wantsToday = prompt.includes("今天") || normalized.includes("today");
  const wantsImportant = prompt.includes("重要") || normalized.includes("important") || normalized.includes("urgent");
  const wantsUnread = prompt.includes("未读") || normalized.includes("unread");
  const priorityRank = { high: 0, medium: 1, low: 2 };

  function pick(options: { today: boolean; important: boolean; unread: boolean }) {
    return emails.filter((email) => {
      if (email.deleted || email.archived) return false;
      if (options.today && !["今天", "today"].includes(String(email.dateLabel).toLowerCase())) return false;
      if (options.important && email.priority !== "high" && !emailCategoryIds(email).includes("deadline")) return false;
      if (options.unread && email.unread === false) return false;
      return true;
    });
  }

  const attempts = [
    { today: wantsToday, important: wantsImportant, unread: wantsUnread },
    { today: wantsToday, important: wantsImportant, unread: false },
    { today: false, important: wantsImportant, unread: false },
    { today: false, important: false, unread: false }
  ];
  const matched = attempts.map(pick).find((items) => items.length) || [];

  return matched
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 3);
}

export function getAssistantReply(prompt: string, language: Language = "zh", emails: Email[] = []): AssistantReply {
  const normalized = prompt.toLowerCase();
  const isEnglish = language === "en";

  if (prompt.includes("未读") || prompt.includes("重要") || normalized.includes("unread") || normalized.includes("important")) {
    const matched = relevantEmails(prompt, emails);
    if (matched.length) {
      return {
        title: isEnglish ? "Important mail" : "重要邮件",
        lines: matched.map((email) => `${email.senderName}: ${email.subject}`)
      };
    }

    if (isEnglish) {
      return {
        title: "Important unread",
        lines: ["OpenAI invite needs confirmation.", "ENT208 feedback is due before Friday.", "Google security alert needs no reply."]
      };
    }

    return {
      title: "重要未读",
      lines: ["OpenAI 邀请需要确认。", "ENT208 反馈需要周五前处理。", "Google 安全提醒无需回复。"]
    };
  }

  if (prompt.includes("日程") || normalized.includes("schedule") || normalized.includes("day")) {
    if (isEnglish) {
      return {
        title: "Today",
        lines: ["Confirm project feedback by 16:00.", "Review event signup email tonight."]
      };
    }

    return {
      title: "今日日程",
      lines: ["16:00 前确认项目反馈。", "晚上检查活动报名邮件。"]
    };
  }

  if (prompt.includes("写信风格") || normalized.includes("style")) {
    if (isEnglish) {
      return {
        title: "Writing style",
        lines: ["Short and direct.", "State the purpose first.", "Close politely with a clear time."]
      };
    }

    return {
      title: "写信风格",
      lines: ["简短直接。", "先说明目的，再给时间点。", "结尾保持礼貌。"]
    };
  }

  if (isEnglish) {
    return {
      title: "Mail assistant",
      lines: ["I will surface emails that need action first.", "Summaries stay within three short lines."]
    };
  }

  return {
    title: "邮件助手",
    lines: ["我会优先找出需要你行动的邮件。", "摘要会保持在三条以内。"]
  };
}

export function generateDraft(idea: string, language: string, tone: string): Draft {
  const isEnglish = language.toLowerCase().includes("english") || language.toLowerCase() === "en";
  const subject = isEnglish ? "Re: Follow-up" : "回复：事项确认";

  if (isEnglish) {
    return {
      subject,
      body: `Hi,\n\nThank you for the update. I will review this carefully and send my response before Friday.\n\nBest regards,\nQingnei\n\nTone: ${tone}\nIdea: ${idea}`
    };
  }

  return {
    subject,
    body: `您好，\n\n谢谢您的提醒。我会按照要求处理，并在周五前提交相关内容。\n\n此致\n青内\n\n写作风格：${tone}\n原始想法：${idea}`
  };
}
