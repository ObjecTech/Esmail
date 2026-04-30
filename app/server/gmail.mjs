const IMPORTANT_TERMS = ["invite", "invited", "security", "alert", "feedback", "before friday", "urgent", "重要", "安全", "反馈", "截止"];
const MARKETING_TERMS = ["unsubscribe", "template", "offer", "newsletter", "promotion", "营销"];
const ACTIVITY_TERMS = ["workshop", "event", "register", "webinar", "活动", "报名"];

export function decodeBase64Url(value = "") {
  if (!value) return "";
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function headerValue(headers = [], name) {
  const header = headers.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function parseSender(value) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    return {
      senderName: name || email.split("@")[0],
      senderEmail: email
    };
  }

  const email = value.trim();
  return {
    senderName: email.includes("@") ? email.split("@")[0] : email || "Unknown",
    senderEmail: email
  };
}

function stripHtml(value) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyFromPayload(payload) {
  if (!payload) return "";

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(decoded) : decoded.trim();
  }

  const parts = payload.parts || [];
  const plainPart = parts.find((part) => part.mimeType === "text/plain" && part.body?.data);
  if (plainPart) return decodeBase64Url(plainPart.body.data).trim();

  const htmlPart = parts.find((part) => part.mimeType === "text/html" && part.body?.data);
  if (htmlPart) return stripHtml(decodeBase64Url(htmlPart.body.data));

  return parts.map(bodyFromPayload).filter(Boolean).join("\n\n").trim();
}

function categoryForText(text) {
  const normalized = text.toLowerCase();
  if (IMPORTANT_TERMS.some((term) => normalized.includes(term))) return "important";
  if (ACTIVITY_TERMS.some((term) => normalized.includes(term))) return "activity";
  if (MARKETING_TERMS.some((term) => normalized.includes(term))) return "marketing";
  if (normalized.includes("verify") || normalized.includes("code")) return "thinking";
  return "important";
}

function priorityForText(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("before friday") || normalized.includes("security")) return "high";
  if (normalized.includes("unsubscribe") || normalized.includes("newsletter")) return "low";
  return "medium";
}

export function shortDateLabel(internalDate, headerDate = "") {
  const parsedHeaderDate = headerDate ? Date.parse(headerDate) : NaN;
  const timestamp = Number.isFinite(parsedHeaderDate) ? parsedHeaderDate : Number(internalDate);
  if (!Number.isFinite(timestamp)) return "最近";
  const date = new Date(timestamp);
  const now = new Date();
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return "今天";
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function defaultSummary(emailText, subject) {
  const clean = emailText.replace(/\s+/g, " ").trim();
  if (!clean) return [subject || "邮件需要查看。"];
  return [clean.slice(0, 72) + (clean.length > 72 ? "..." : "")];
}

export function mapGmailMessageToEmail(message) {
  const headers = message.payload?.headers || [];
  const from = parseSender(headerValue(headers, "From"));
  const subject = headerValue(headers, "Subject") || "(No subject)";
  const dateHeader = headerValue(headers, "Date");
  const body = bodyFromPayload(message.payload) || message.snippet || "";
  const combined = `${subject} ${message.snippet || ""} ${body}`;
  const fallbackCategoryId = categoryForText(combined);
  const labels = message.labelIds || [];

  return {
    id: message.id,
    senderName: from.senderName,
    senderEmail: from.senderEmail,
    subject,
    snippet: message.snippet || body.slice(0, 120),
    body,
    dateLabel: shortDateLabel(message.internalDate, dateHeader),
    fallbackCategoryId,
    priority: priorityForText(combined),
    summaryBullets: defaultSummary(body || message.snippet || "", subject),
    starred: labels.includes("STARRED"),
    archived: !labels.includes("INBOX"),
    deleted: labels.includes("TRASH"),
    unread: labels.includes("UNREAD")
  };
}

export function buildRawEmail({ to, from, subject, body }) {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body
  ].join("\r\n");

  return encodeBase64Url(message);
}
