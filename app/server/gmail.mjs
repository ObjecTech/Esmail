import { classifyEmailText, primaryCategoryId, priorityForCategories } from "./classification.mjs";

export function decodeBase64Url(value = "") {
  if (!value) return "";
  return Buffer.from(value, "base64url").toString("utf8");
}

function decodeBytes(buffer, charset = "utf-8") {
  const normalized = String(charset || "utf-8").trim().replace(/^"|"$/g, "").toLowerCase();
  const label = {
    gb2312: "gb18030",
    gbk: "gb18030",
    "windows-936": "gb18030",
    cp936: "gb18030",
    utf8: "utf-8",
    "us-ascii": "utf-8"
  }[normalized] || normalized;

  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

export function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function headerValue(headers = [], name) {
  const header = headers.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function charsetFromHeaders(headers = []) {
  const contentType = headerValue(headers, "Content-Type");
  return contentType.match(/charset\s*=\s*("?[^";\r\n]+"?)/i)?.[1]?.replace(/^"|"$/g, "") || "utf-8";
}

function decodeMimeWords(value = "") {
  return String(value).replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_match, charset, encoding, text) => {
    const normalizedCharset = String(charset).toLowerCase();
    const buffer = String(encoding).toUpperCase() === "B"
      ? Buffer.from(text, "base64")
      : Buffer.from(
          text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_hex, valueHex) => String.fromCharCode(parseInt(valueHex, 16))),
          "binary"
        );
    try {
      const decoder = new TextDecoder({
        gb2312: "gb18030",
        gbk: "gb18030",
        utf8: "utf-8",
        "us-ascii": "utf-8"
      }[normalizedCharset] || normalizedCharset);
      return decoder.decode(buffer);
    } catch {
      return buffer.toString("utf8");
    }
  }).trim();
}

function parseSender(value) {
  const decoded = decodeMimeWords(value);
  const match = decoded.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    return {
      senderName: name || email.split("@")[0],
      senderEmail: email
    };
  }

  const email = decoded.trim();
  return {
    senderName: email.includes("@") ? email.split("@")[0] : email || "Unknown",
    senderEmail: email
  };
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripHtml(value) {
  return sanitizeHtml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .trim();
}

function walkParts(payload, parts = []) {
  if (!payload) return "";
  parts.push(payload);
  for (const part of payload.parts || []) walkParts(part, parts);
  return parts;
}

function contentFromPayload(payload) {
  const parts = walkParts(payload, []);
  const plainPart = parts.find((part) => part.mimeType === "text/plain" && part.body?.data);
  const htmlPart = parts.find((part) => part.mimeType === "text/html" && part.body?.data);
  const text = plainPart
    ? decodeBytes(Buffer.from(plainPart.body.data, "base64url"), charsetFromHeaders(plainPart.headers || [])).trim()
    : "";
  let htmlBody = "";
  if (htmlPart) {
    const decoded = decodeBytes(Buffer.from(htmlPart.body.data, "base64url"), charsetFromHeaders(htmlPart.headers || []));
    htmlBody = sanitizeHtml(decoded);
  }

  return {
    text: text || stripHtml(htmlBody),
    htmlBody
  };
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

function payloadHasAttachment(part) {
  if (!part) return false;
  const disposition = headerValue(part.headers || [], "Content-Disposition");
  if (part.filename || part.body?.attachmentId || /attachment/i.test(disposition)) return true;
  return (part.parts || []).some(payloadHasAttachment);
}

export function mapGmailMessageToEmail(message) {
  const headers = message.payload?.headers || [];
  const from = parseSender(headerValue(headers, "From"));
  const to = decodeMimeWords(headerValue(headers, "To"));
  const cc = decodeMimeWords(headerValue(headers, "Cc"));
  const subject = decodeMimeWords(headerValue(headers, "Subject")) || "(No subject)";
  const dateHeader = headerValue(headers, "Date");
  const content = contentFromPayload(message.payload);
  const body = content.text || message.snippet || "";
  const combined = `${subject} ${message.snippet || ""} ${body}`;
  const fallbackCategoryIds = classifyEmailText({
    from: `${from.senderName} ${from.senderEmail}`,
    subject,
    snippet: message.snippet || "",
    body
  });
  const fallbackCategoryId = primaryCategoryId(fallbackCategoryIds);
  const labels = message.labelIds || [];
  const deleted = labels.includes("TRASH");
  const draft = labels.includes("DRAFT");
  const sent = labels.includes("SENT");
  const spam = labels.includes("SPAM");

  return {
    id: message.id,
    senderName: from.senderName,
    senderEmail: from.senderEmail,
    to,
    cc,
    subject,
    snippet: message.snippet || body.slice(0, 120),
    body,
    htmlBody: content.htmlBody,
    dateLabel: shortDateLabel(message.internalDate, dateHeader),
    fallbackCategoryIds,
    categoryIds: fallbackCategoryIds,
    fallbackCategoryId,
    categoryId: fallbackCategoryId,
    priority: priorityForCategories(fallbackCategoryIds, combined),
    summaryBullets: defaultSummary(body || message.snippet || "", subject),
    starred: labels.includes("STARRED"),
    archived: !labels.includes("INBOX") && !deleted && !draft && !sent && !spam,
    deleted,
    draft,
    sent,
    spam,
    unread: labels.includes("UNREAD"),
    hasAttachments: payloadHasAttachment(message.payload)
  };
}

export async function extractGmailImages(message, attachmentResolver, options = {}) {
  const maxImages = options.maxImages || 8;
  const maxBytes = options.maxBytes || 2_000_000;
  const images = [];
  const parts = walkParts(message.payload, []);

  for (const part of parts) {
    if (!String(part.mimeType || "").startsWith("image/")) continue;
    if (images.length >= maxImages) break;

    const headers = part.headers || [];
    const contentId = headerValue(headers, "Content-ID").replace(/^<|>$/g, "");
    const disposition = headerValue(headers, "Content-Disposition");
    const filename = part.filename || contentId || `image-${images.length + 1}`;
    const attachmentId = part.body?.attachmentId;
    const data = part.body?.data || (attachmentId && attachmentResolver ? await attachmentResolver(attachmentId) : "");
    if (!data) continue;

    const bytes = Buffer.from(data, "base64url");
    if (bytes.length > maxBytes) continue;
    images.push({
      filename,
      mimeType: part.mimeType,
      contentId,
      disposition,
      dataUrl: `data:${part.mimeType};base64,${bytes.toString("base64")}`
    });
  }

  return images;
}

export function inlineImagesInHtml(htmlBody = "", images = []) {
  let html = htmlBody || "";
  for (const image of images) {
    if (!image.contentId || !image.dataUrl) continue;
    const escaped = image.contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`cid:${escaped}`, "gi"), image.dataUrl);
  }
  return html;
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
