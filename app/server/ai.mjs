import { CATEGORY_DEFINITIONS, classifyEmailText, normalizeCategoryIds, primaryCategoryId, priorityForCategories } from "./classification.mjs";

const DEFAULT_SYSTEM_PROMPT = [
  "You are Esmail's email assistant.",
  "Keep answers short, practical, and important.",
  "When summarizing emails, use no more than 3 bullet points.",
  "Reply in the same language as the user unless explicitly asked otherwise."
].join(" ");

export function buildChatPayload({ model, messages, temperature = 0.3 }) {
  return {
    model,
    temperature,
    messages: [
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      ...messages
    ]
  };
}

export function summarizeAnalysisPrompt(emails) {
  const compactEmails = emails.slice(0, 12).map((email) => ({
    id: email.id,
    from: `${email.senderName} <${email.senderEmail}>`,
    subject: email.subject,
    snippet: email.snippet,
    body: (email.body || "").slice(0, 1200),
    categoryIds: email.categoryIds || email.fallbackCategoryIds || [email.categoryId || email.fallbackCategoryId].filter(Boolean),
    priority: email.priority,
    dateLabel: email.dateLabel
  }));

  return [
    "请分析这些邮件，并只返回 JSON 数组，不要返回 Markdown。",
    `可用标签只能来自：${CATEGORY_DEFINITIONS.map((category) => `${category.id}=${category.label}`).join(", ")}`,
    "同一封邮件可以有多个标签。每项格式：{\"id\":\"邮件ID\",\"summaryBullets\":[\"最多 3 条，简短具体\"],\"todoTitle\":\"如需行动则一句话，否则空字符串\",\"categoryIds\":[\"course\",\"deadline\"]}",
    "分类原则：邮件标题开头是三个英文字母加三个数字（例如 DTS206、ENT208）用 course；邮件包含截止、due、deadline、submit、closing date、expires、截止、到期、最晚、之前等期限表达用 deadline；发件人包含 museum、SA-Office、SCC、MITSNotice、lifelonglearning、XIPU Insititution、LIB、liverpool、UniversityCommunications、AOA、studyabroad 用 university-notice；发件人包含 XJTLU External Mentor 或 XJTLU Career Centre 用 career-internship；邮件包含 Do not reply 用 system-notification；不属于任何其他标签时用 others。",
    "摘要必须基于邮件正文和主题，不要编造不存在的截止时间、发件人或行动。",
    JSON.stringify(compactEmails, null, 2)
  ].join("\n");
}

export function buildInboxContext(emails = [], language = "zh") {
  const compactEmails = emails.slice(0, 20).map((email) => ({
    id: email.id,
    date: email.dateLabel,
    from: `${email.senderName} <${email.senderEmail}>`,
    subject: email.subject,
    snippet: email.snippet,
    body: (email.body || "").slice(0, 420),
    categoryIds: email.categoryIds || email.fallbackCategoryIds || [email.categoryId || email.fallbackCategoryId].filter(Boolean),
    priority: email.priority,
    unread: email.unread !== false,
    starred: Boolean(email.starred)
  }));

  return [
    language === "en"
      ? "Use the inbox context below. If the user asks about unread, important, today, sender, tasks, schedule, or summaries, answer from these emails instead of saying you cannot access mail."
      : "请使用下面的收件箱上下文。如果用户询问未读、重要、今天、发件人、待办、日程或总结，请直接基于这些邮件回答，不要说无法访问邮箱。",
    language === "en"
      ? "Keep the answer short: title plus up to 3 bullets. Mention sender and required action when useful."
      : "回答要简短：标题加最多 3 条要点。必要时说明发件人和需要做的事。",
    JSON.stringify(compactEmails, null, 2)
  ].join("\n");
}

export function buildContextualChatPrompt(prompt, emails = [], language = "zh") {
  if (!emails.length) return prompt;
  return `${buildInboxContext(emails, language)}\n\n用户问题：${prompt}`;
}

function extractTextFromChatResponse(data) {
  return data?.choices?.[0]?.message?.content || data?.output_text || "";
}

export function parseJsonish(text, fallback) {
  if (!text) return fallback;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[1]);
    } catch {
      return fallback;
    }
  }
}

export async function callChatAnywhere({ apiKey, baseUrl, model, messages, temperature, timeoutMs = 8000 }) {
  if (!apiKey) {
    throw new Error("CHATANYWHERE_API_KEY is missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify(buildChatPayload({ model, messages, temperature }))
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`AI request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `AI request failed with ${response.status}`);
  }

  return extractTextFromChatResponse(data);
}

export function soundsLikeMissingMailboxAccess(text = "") {
  const normalized = text.toLowerCase();
  return [
    "无法直接访问",
    "无法访问",
    "不能直接读取",
    "不能访问你的邮箱",
    "需要更多信息",
    "cannot access",
    "can't access",
    "cannot directly access",
    "can't directly access",
    "do not have access",
    "don't have access",
    "need more information",
    "provide email"
  ].some((phrase) => normalized.includes(phrase));
}

export function shouldAnswerFromInboxContext(prompt = "") {
  const normalized = prompt.toLowerCase();
  const asksForMail = prompt.includes("邮件") || prompt.includes("邮箱") || normalized.includes("mail") || normalized.includes("email") || normalized.includes("inbox");
  const asksForSummary = prompt.includes("总结") || prompt.includes("未读") || prompt.includes("重要") || normalized.includes("summarize") || normalized.includes("summary") || normalized.includes("unread") || normalized.includes("important");
  return asksForMail && asksForSummary;
}

function relevantEmails(prompt, emails = []) {
  const normalized = prompt.toLowerCase();
  const wantsToday = prompt.includes("今天") || normalized.includes("today");
  const wantsImportant = prompt.includes("重要") || normalized.includes("important") || normalized.includes("urgent");
  const wantsUnread = prompt.includes("未读") || normalized.includes("unread");

  function pick(options) {
    return emails.filter((email) => {
      if (email.deleted || email.archived) return false;
      if (options.today && !["今天", "today"].includes(String(email.dateLabel).toLowerCase())) return false;
      const categoryIds = email.categoryIds || email.fallbackCategoryIds || [email.categoryId || email.fallbackCategoryId].filter(Boolean);
      if (options.important && (email.priority !== "high" && !categoryIds.includes("deadline"))) return false;
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
    .sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    })
    .slice(0, 3);
}

export function fallbackChatReply(prompt, language, emails = []) {
  const isEnglish = language === "en";
  const normalized = prompt.toLowerCase();
  if (normalized.includes("unread") || prompt.includes("未读") || prompt.includes("重要")) {
    const matched = relevantEmails(prompt, emails);
    if (matched.length) {
      return isEnglish
        ? `Important mail:\n${matched.map((email) => `- ${email.senderName}: ${email.subject}`).join("\n")}`
        : `重要邮件：\n${matched.map((email) => `- ${email.senderName}：${email.subject}`).join("\n")}`;
    }

    return isEnglish
      ? "Important unread:\n- OpenAI invite needs confirmation.\n- ENT208 feedback is due before Friday.\n- Google security alert needs no reply."
      : "重要未读：\n- OpenAI 邀请需要确认。\n- ENT208 反馈需要周五前处理。\n- Google 安全提醒无需回复。";
  }

  return isEnglish
    ? "I can help summarize, draft, classify, and turn emails into short todos."
    : "我可以帮你总结、写邮件、分类，并把重要邮件变成简短待办。";
}

export function fallbackDraft({ idea, language, tone }) {
  const isEnglish = language === "en" || language === "English";
  if (isEnglish) {
    return {
      subject: "Re: Follow-up",
      body: `Hi,\n\nThank you for the update. I will review this and send my response before Friday.\n\nBest regards,\nQingnei\n\nTone: ${tone}\nIdea: ${idea}`
    };
  }

  return {
    subject: "回复：事项确认",
    body: `您好，\n\n谢谢您的提醒。我会按要求处理，并在周五前提交相关内容。\n\n此致\n青内\n\n写作风格：${tone}\n原始想法：${idea}`
  };
}

export function fallbackAnalysis(emails) {
  return emails.map((email) => ({
    id: email.id,
    summaryBullets: email.summaryBullets?.length ? email.summaryBullets.slice(0, 3) : [email.snippet || email.subject],
    todoTitle: email.priority === "high" ? `处理：${email.subject}` : "",
    categoryIds: normalizeCategoryIds(email.categoryIds || email.fallbackCategoryIds).length
      ? normalizeCategoryIds(email.categoryIds || email.fallbackCategoryIds)
      : classifyEmailText({
          from: `${email.senderName} ${email.senderEmail}`,
          subject: email.subject,
          snippet: email.snippet,
          body: email.body
        })
  })).map((item, index) => ({
    ...item,
    categoryId: primaryCategoryId(item.categoryIds),
    priority: priorityForCategories(item.categoryIds, `${emails[index]?.subject || ""} ${emails[index]?.snippet || ""} ${emails[index]?.body || ""}`)
  }));
}
