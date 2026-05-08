import { CATEGORY_DEFINITIONS, classifyEmailText, normalizeCategoryIds, primaryCategoryId, priorityForCategories } from "./classification.mjs";

const DEFAULT_SYSTEM_PROMPT = [
  "You are Esmail's email assistant.",
  "Keep answers short, practical, and important.",
  "When summarizing emails, use 1 to 5 bullet points depending on how many key points the email contains.",
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

export function summarizeAnalysisPrompt(emails, language = "en") {
  const compactEmails = emails.slice(0, 15).map((email) => ({
    id: email.id,
    from: `${email.senderName} <${email.senderEmail}>`,
    subject: email.subject,
    snippet: email.snippet,
    body: (email.body || "").slice(0, 1200),
    categoryIds: email.categoryIds || email.fallbackCategoryIds || [email.categoryId || email.fallbackCategoryId].filter(Boolean),
    priority: email.priority,
    dateLabel: email.dateLabel
  }));

  const categoryList = CATEGORY_DEFINITIONS.map((category) => `${category.id}=${category.label}`).join(", ");
  const instructions = language === "en"
    ? [
        "Analyze these emails. Return JSON only, with no Markdown.",
        `Allowed labels only: ${categoryList}`,
        "One email may have multiple labels. Item format: {\"id\":\"email id\",\"summaryBullets\":[\"1-5 concise English bullets, use fewer when there are fewer key points\"],\"todoTitle\":\"one English action sentence if action is needed, otherwise empty string\",\"categoryIds\":[\"course\",\"deadline\"]}",
        "Classification rules: subjects starting with three letters plus three digits such as DTS206 or ENT208 use course; due, deadline, submit, closing date, expires, 截止, 到期, 最晚, 之前 use deadline; senders including museum, SA-Office, SCC, MITSNotice, lifelonglearning, XIPU Insititution, LIB, liverpool, UniversityCommunications, AOA, studyabroad use university-notice; XJTLU External Mentor or XJTLU Career Centre use career-internship; Do not reply use system-notification; otherwise use others.",
        "Summaries must be written in English and based on the email body and subject. Do not invent deadlines, senders, or actions."
      ]
    : [
        "请分析这些邮件，并只返回 JSON 数组，不要返回 Markdown。",
        `可用标签只能来自：${categoryList}`,
        "同一封邮件可以有多个标签。每项格式：{\"id\":\"邮件ID\",\"summaryBullets\":[\"1-5 条中文要点，少则 1 条，多则最多 5 条，简短具体\"],\"todoTitle\":\"如需行动则一句中文话，否则空字符串\",\"categoryIds\":[\"course\",\"deadline\"]}",
        "分类原则：邮件标题开头是三个英文字母加三个数字（例如 DTS206、ENT208）用 course；邮件包含截止、due、deadline、submit、closing date、expires、截止、到期、最晚、之前等期限表达用 deadline；发件人包含 museum、SA-Office、SCC、MITSNotice、lifelonglearning、XIPU Insititution、LIB、liverpool、UniversityCommunications、AOA、studyabroad 用 university-notice；发件人包含 XJTLU External Mentor 或 XJTLU Career Centre 用 career-internship；邮件包含 Do not reply 用 system-notification；不属于任何其他标签时用 others。",
        "摘要必须使用中文，并基于邮件正文和主题，不要编造不存在的截止时间、发件人或行动。"
      ];

  return [
    ...instructions,
    JSON.stringify(compactEmails, null, 2)
  ].join("\n");
}

export function buildInboxContext(emails = [], language = "en") {
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
      ? "Keep the answer short: title plus 1 to 5 bullets depending on the number of key points. Mention sender and required action when useful."
      : "回答要简短：标题加 1-5 条要点，按重点数量决定。必要时说明发件人和需要做的事。",
    language === "en"
      ? "If one email clearly matches the user's course, week, sender, date, or subject keywords, use that email as the main source and directly answer the user's question."
      : "如果某封邮件明显匹配用户提到的课程、周次、发件人、日期或主题关键词，请以这封邮件为主要依据，直接回答用户的问题。",
    JSON.stringify(compactEmails, null, 2)
  ].join("\n");
}

export function buildContextualChatPrompt(prompt, emails = [], language = "en") {
  if (!emails.length) return prompt;
  const questionLabel = language === "en" ? "User question" : "用户问题";
  return `${buildInboxContext(emails, language)}\n\n${questionLabel}：${prompt}`;
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

function normalizeChatProviders({ providers, apiKeys, apiKey, baseUrl, model }) {
  if (Array.isArray(providers) && providers.length) {
    return providers
      .filter((provider) => provider?.apiKey)
      .map((provider) => ({
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl || baseUrl,
        model: provider.model || model
      }));
  }
  const keys = Array.isArray(apiKeys) && apiKeys.length ? apiKeys : [apiKey];
  return keys
    .filter(Boolean)
    .map((key) => ({ apiKey: key, baseUrl, model }));
}

function isQuotaLimitedError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 || [
    "limited to 200",
    "free account is limited",
    "每日200",
    "每日 200",
    "quota",
    "rate limit"
  ].some((phrase) => message.includes(phrase));
}

function isRetryableProviderError(error) {
  const message = String(error?.message || "").toLowerCase();
  return isQuotaLimitedError(error) || [
    "timed out",
    "fetch failed",
    "network",
    "econnreset",
    "etimedout",
    "und_err_connect_timeout"
  ].some((phrase) => message.includes(phrase));
}

async function callSingleChatProvider({ apiKey, baseUrl, model, messages, temperature, timeoutMs }) {
  if (!apiKey) {
    throw new Error("CHATANYWHERE_API_KEY is missing");
  }
  if (!baseUrl) {
    throw new Error("CHATANYWHERE_BASE_URL is missing");
  }
  if (!model) {
    throw new Error("AI_MODEL is missing");
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
    const error = new Error(data?.error?.message || `AI request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return extractTextFromChatResponse(data);
}

export async function callChatAnywhere({ apiKey, apiKeys, providers, baseUrl, model, messages, temperature, timeoutMs = 8000 }) {
  const candidates = normalizeChatProviders({ providers, apiKeys, apiKey, baseUrl, model });
  if (!candidates.length) {
    throw new Error("CHATANYWHERE_API_KEY is missing");
  }

  let lastError;
  for (const [index, provider] of candidates.entries()) {
    try {
      return await callSingleChatProvider({ ...provider, messages, temperature, timeoutMs });
    } catch (error) {
      lastError = error;
      if (index < candidates.length - 1 && isRetryableProviderError(error)) continue;
      throw error;
    }
  }

  throw lastError;
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

function normalizeSearchText(value = "") {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ");
}

function searchTokens(prompt = "") {
  const latinTokens = prompt.match(/[a-z0-9]{2,}/gi)?.map((token) => token.toLowerCase()) || [];
  const cjkTokens = (prompt.match(/[\u4e00-\u9fff]{2,}/g) || []).flatMap((segment) =>
    Array.from({ length: Math.max(0, segment.length - 1) }, (_, index) => segment.slice(index, index + 2))
  );
  const semanticTokens = [];
  if (/[考试]/.test(prompt)) semanticTokens.push("exam", "final");
  if (prompt.includes("安排") || prompt.includes("日程") || prompt.includes("时间")) semanticTokens.push("schedule", "arrangement", "timetable");
  if (prompt.includes("王超群") || prompt.includes("超群")) semanticTokens.push("chaoqun", "wang");
  return Array.from(new Set([...latinTokens, ...cjkTokens, ...semanticTokens]));
}

function coursePrefixTokens(prompt = "") {
  const matches = prompt.match(/[a-z]{2,4}\d{0,3}(?:tc)?/gi) || [];
  return Array.from(new Set(matches.map((token) => token.toLowerCase().replace(/tc$/, "")).filter((token) => /^(dts|ent)\d{0,3}$/.test(token))));
}

function textMatchesCoursePrefix(text = "", courseToken) {
  const tokens = normalizeSearchText(text).split(/\s+/);
  if (/\d/.test(courseToken)) return tokens.some((token) => token.startsWith(courseToken));
  return tokens.some((token) => token.startsWith(courseToken) && /\d/.test(token));
}

function emailSearchText(email) {
  return [
    email.senderName,
    email.senderEmail,
    email.subject,
    email.snippet,
    email.body,
    ...(email.summaryBullets || [])
  ].filter(Boolean).join(" ");
}

function searchMatchedEmails(prompt, emails = [], limit = 3) {
  const ignoredTokens = new Set(["邮件", "邮箱", "email", "mail", "老师", "帮我", "找", "查", "关于"]);
  const tokens = searchTokens(prompt).filter((token) => !ignoredTokens.has(token.toLowerCase()));
  const requiredLatinTokens = tokens.filter((token) => /^[a-z0-9]{3,}$/i.test(token) && !["exam", "final", "schedule", "today", "unread"].includes(token));
  const requiredCoursePrefixes = coursePrefixTokens(prompt);
  return emails
    .filter((email) => !email.deleted && !email.archived)
    .map((email, index) => {
      const subject = normalizeSearchText(email.subject);
      const sender = normalizeSearchText(`${email.senderName} ${email.senderEmail}`);
      const snippet = normalizeSearchText(email.snippet);
      const body = normalizeSearchText(email.body);
      const fullText = normalizeSearchText(emailSearchText(email));
      const matchesRequiredToken = !requiredLatinTokens.length || requiredLatinTokens.some((token) => fullText.includes(token));
      const matchesCoursePrefix = !requiredCoursePrefixes.length || requiredCoursePrefixes.some((token) => textMatchesCoursePrefix(fullText, token));
      const score = matchesRequiredToken && matchesCoursePrefix
        ? tokens.reduce((total, token) => {
            const normalizedToken = normalizeSearchText(token).trim();
            if (!normalizedToken) return total;
            return total
              + (subject.includes(normalizedToken) ? 8 : 0)
              + (sender.includes(normalizedToken) ? 7 : 0)
              + (snippet.includes(normalizedToken) ? 4 : 0)
              + (body.includes(normalizedToken) ? 2 : 0);
          }, 0)
        : 0;
      return { email, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.email);
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

  const matched = searchMatchedEmails(prompt, emails);
  if (matched.length) {
    const top = matched[0];
    const bullets = fallbackSummaryBullets(top).slice(0, 5);
    const title = top.subject || (isEnglish ? "Relevant mail" : "相关邮件");
    const senderLine = isEnglish ? `Sender: ${top.senderName}` : `发件人：${top.senderName}`;
    return `${title}\n- ${senderLine}\n${bullets.map((line) => `- ${line}`).join("\n")}`;
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

function cleanSummaryText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function truncateSummary(value, maxLength = 120) {
  const clean = cleanSummaryText(value);
  return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}...` : clean;
}

function fallbackSummaryBullets(email) {
  if (email.summaryBullets?.length) return email.summaryBullets.slice(0, 5);

  const body = cleanSummaryText(email.body || "");
  if (body) {
    const subject = cleanSummaryText(email.subject || "").toLowerCase();
    const snippet = cleanSummaryText(email.snippet || "").toLowerCase();
    const candidates = body
      .split(/(?<=[.!?。！？])\s+|\n+/)
      .map(cleanSummaryText)
      .filter((line) => line.length >= 18);
    const ranked = candidates
      .map((line, index) => {
        const normalized = line.toLowerCase();
        const repeatsTitle = (subject && (subject.includes(normalized) || normalized.includes(subject))) || (snippet && snippet.includes(normalized));
        const hasOutcome = /completed|complete|review|deadline|due|submit|submitted|marking|截止|完成|提交|反馈|查看|处理/i.test(line);
        const looksLikeNavigation = /»|forums|announcements|http|www\./i.test(line);
        const looksLikeHeader = /\bby\s+[A-Z][A-Za-z]/.test(line) && !/\b(has|is|will|please|need|needs|due|must)\b/i.test(line);
        return {
          line,
          index,
          score: (hasOutcome ? 4 : 0) - (repeatsTitle ? 3 : 0) - (looksLikeNavigation ? 2 : 0) - (looksLikeHeader ? 3 : 0)
        };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);
    return [truncateSummary(ranked[0]?.line || body)];
  }

  return [truncateSummary(email.snippet || email.subject || "Email needs review.")];
}

export function fallbackAnalysis(emails) {
  return emails.map((email) => ({
    id: email.id,
    summaryBullets: fallbackSummaryBullets(email),
    todoTitle: email.priority === "high" ? `Handle: ${email.subject}` : "",
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
