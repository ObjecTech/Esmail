import tls from "node:tls";
import { TextDecoder } from "node:util";
import { shortDateLabel } from "./gmail.mjs";

const IMPORTANT_TERMS = ["urgent", "security", "alert", "deadline", "重要", "安全", "提醒", "截止", "作业"];
const MARKETING_TERMS = ["unsubscribe", "offer", "newsletter", "promotion", "优惠", "活动", "营销"];

function createLineClient({ host, port }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    const queue = [];
    const waiters = [];
    let buffer = "";
    let settled = false;

    const cleanup = () => {
      socket.removeAllListeners("error");
      socket.removeAllListeners("timeout");
    };

    socket.setTimeout(18_000);
    socket.on("secureConnect", () => {
      settled = true;
      cleanup();
      socket.on("error", () => {
        // Command-level timeouts surface connection problems to callers.
      });
      resolve({
        write(line) {
          socket.write(`${line}\r\n`);
        },
        end() {
          socket.end();
        },
        nextLine(timeoutMs = 18_000) {
          if (queue.length) return Promise.resolve(queue.shift());
          return new Promise((lineResolve, lineReject) => {
            const timer = setTimeout(() => {
              const index = waiters.findIndex((waiter) => waiter.resolve === lineResolve);
              if (index >= 0) waiters.splice(index, 1);
              lineReject(new Error("Mail server response timed out"));
            }, timeoutMs);
            waiters.push({
              resolve: (line) => {
                clearTimeout(timer);
                lineResolve(line);
              }
            });
          });
        },
        async readUntil(predicate, timeoutMs = 18_000) {
          const lines = [];
          const startedAt = Date.now();
          while (Date.now() - startedAt < timeoutMs) {
            const line = await this.nextLine(Math.max(500, timeoutMs - (Date.now() - startedAt)));
            lines.push(line);
            if (predicate(line, lines)) return lines;
          }
          throw new Error("Mail server response timed out");
        }
      });
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const waiter = waiters.shift();
        if (waiter) waiter.resolve(line);
        else queue.push(line);
      }
    });

    socket.on("error", (error) => {
      if (!settled) reject(error);
    });
    socket.on("timeout", () => {
      socket.destroy();
      if (!settled) reject(new Error("Mail server connection timed out"));
    });
  });
}

function imapQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function verifyImapLogin({ email, authCode, imapHost, imapPort }) {
  const client = await createLineClient({ host: imapHost, port: imapPort });
  try {
    await client.readUntil((line) => line.startsWith("* OK"));
    client.write(`A1 LOGIN ${imapQuote(email)} ${imapQuote(authCode)}`);
    const lines = await client.readUntil((line) => /^A1 (OK|NO|BAD)/i.test(line));
    const finalLine = lines.at(-1) || "";
    if (!/^A1 OK/i.test(finalLine)) {
      throw new Error("QQ IMAP 登录失败，请确认邮箱授权码和 IMAP 服务已开启。");
    }
    client.write("A2 LOGOUT");
  } finally {
    client.end();
  }
}

async function readSmtpResponse(client) {
  const lines = [];
  while (true) {
    const line = await client.nextLine();
    lines.push(line);
    if (/^\d{3} /.test(line)) return lines;
  }
}

function expectSmtp(lines, codes, message) {
  const last = lines.at(-1) || "";
  const code = last.slice(0, 3);
  if (!codes.includes(code)) throw new Error(message || last || "SMTP request failed");
}

async function smtpAuth({ client, email, authCode }) {
  client.write("AUTH LOGIN");
  expectSmtp(await readSmtpResponse(client), ["334"], "QQ SMTP 认证失败。");
  client.write(Buffer.from(email, "utf8").toString("base64"));
  expectSmtp(await readSmtpResponse(client), ["334"], "QQ SMTP 邮箱账号未被接受。");
  client.write(Buffer.from(authCode, "utf8").toString("base64"));
  expectSmtp(await readSmtpResponse(client), ["235"], "QQ SMTP 登录失败，请使用 QQ 邮箱授权码。");
}

async function verifySmtpLogin({ email, authCode, smtpHost, smtpPort }) {
  const client = await createLineClient({ host: smtpHost, port: smtpPort });
  try {
    expectSmtp(await readSmtpResponse(client), ["220"], "QQ SMTP 服务器无响应。");
    client.write("EHLO esmail.local");
    expectSmtp(await readSmtpResponse(client), ["250"], "QQ SMTP EHLO 失败。");
    await smtpAuth({ client, email, authCode });
    client.write("QUIT");
  } finally {
    client.end();
  }
}

export async function verifyQqMailbox(settings) {
  await verifyImapLogin(settings);
  await verifySmtpLogin(settings);
}

export function decodeMimeWords(value = "") {
  return value.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_match, charset, encoding, text) => {
    const normalizedCharset = String(charset).toLowerCase();
    if (String(encoding).toUpperCase() === "B") {
      return decodeBytes(Buffer.from(text, "base64"), normalizedCharset);
    }
    const bytes = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_hex, valueHex) => String.fromCharCode(parseInt(valueHex, 16)));
    return decodeBytes(Buffer.from(bytes, "binary"), normalizedCharset);
  }).trim();
}

function parseHeader(raw, name) {
  const match = raw.match(new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n[^\\s]|$)`, "im"));
  return decodeMimeWords((match?.[1] || "").replace(/\r?\n\s+/g, " ").trim());
}

function parseSender(value) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = decodeMimeWords(match[1].trim().replace(/^"|"$/g, ""));
    const email = match[2].trim();
    return { senderName: name || email.split("@")[0], senderEmail: email };
  }
  const email = value.trim();
  return { senderName: email.includes("@") ? email.split("@")[0] : email || "QQ邮箱", senderEmail: email };
}

function stripImapLiterals(raw) {
  return raw
    .replace(/\* \d+ FETCH[\s\S]*?\{[\d]+\}\r?\n/gi, "")
    .replace(/\bBODY(?:\.PEEK)?\[[^\]]*\](?:<\d+(?:\.\d+)?>)?\s*\{\d+\}\r?\n/gi, "")
    .replace(/\bBODY\[[^\]]*\](?:<\d+(?:\.\d+)?>)?\s*\{\d+\}/gi, "")
    .replace(/\bUID\s+\d+\b/gi, "")
    .replace(/\)\r?\n[A-Z]\d+ OK[\s\S]*$/i, "")
    .replace(/\r?\n[A-Z]\d+ OK[\s\S]*$/i, "")
    .replace(/\)\s*$/g, "")
    .trim();
}

function normalizeCharset(charset = "utf-8") {
  return String(charset).trim().replace(/^"|"$/g, "").toLowerCase() || "utf-8";
}

function charsetFromHeaders(headers = "") {
  const match = headers.match(/charset\s*=\s*("?[^";\r\n]+"?)/i);
  return normalizeCharset(match?.[1] || "utf-8");
}

function transferEncodingFromHeaders(headers = "") {
  return (headers.match(/content-transfer-encoding\s*:\s*([^\r\n]+)/i)?.[1] || "7bit").trim().toLowerCase();
}

function decodeBytes(buffer, charset = "utf-8") {
  const normalized = normalizeCharset(charset);
  const label = {
    "gb2312": "gb18030",
    "gbk": "gb18030",
    "windows-936": "gb18030",
    "cp936": "gb18030",
    "utf8": "utf-8",
    "us-ascii": "utf-8"
  }[normalized] || normalized;

  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

function decodeQuotedPrintableToBuffer(value = "") {
  const softUnwrapped = value.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let index = 0; index < softUnwrapped.length; index += 1) {
    if (softUnwrapped[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(softUnwrapped.slice(index + 1, index + 3))) {
      bytes.push(parseInt(softUnwrapped.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(softUnwrapped.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function decodeTransferBody(value = "", encoding = "7bit", charset = "utf-8") {
  const normalized = encoding.toLowerCase();
  if (normalized === "base64") {
    return decodeBytes(Buffer.from(value.replace(/\s+/g, ""), "base64"), charset);
  }
  if (normalized === "quoted-printable") {
    return decodeBytes(decodeQuotedPrintableToBuffer(value), charset);
  }
  if (normalizeCharset(charset).includes("utf")) return value;
  return decodeBytes(Buffer.from(value, "binary"), charset);
}

function cleanupTextBody(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeBase64Body(value = "") {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 80 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}

function splitHeaderAndBody(raw = "") {
  const match = raw.match(/\r?\n\r?\n/);
  if (!match) return { headers: "", body: raw };
  const index = match.index || 0;
  return {
    headers: raw.slice(0, index),
    body: raw.slice(index + match[0].length)
  };
}

function boundaryFromHeaders(headers = "") {
  return headers.match(/boundary\s*=\s*"([^"]+)"/i)?.[1] || headers.match(/boundary\s*=\s*([^;\r\n]+)/i)?.[1]?.trim();
}

function splitMultipart(body = "", boundary = "") {
  if (!boundary) return [];
  return body
    .split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\s*`, "g"))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function decodeMimeBody(raw = "") {
  const clean = stripImapLiterals(raw);
  if (looksLikeBase64Body(clean)) return cleanupTextBody(decodeTransferBody(clean, "base64"));

  const { headers, body } = splitHeaderAndBody(clean);
  const boundary = boundaryFromHeaders(headers) || boundaryFromHeaders(body.slice(0, 1200));
  const candidateParts = boundary ? splitMultipart(body, boundary) : [body];

  const decodedParts = candidateParts
    .map((part) => {
      const section = splitHeaderAndBody(part);
      const partHeaders = section.headers || headers;
      const contentType = (partHeaders.match(/content-type\s*:\s*([^\r\n;]+)/i)?.[1] || "").toLowerCase();
      const charset = charsetFromHeaders(partHeaders);
      const transferEncoding = transferEncodingFromHeaders(partHeaders);
      const decoded = cleanupTextBody(decodeTransferBody(section.body, transferEncoding, charset));
      return { contentType, decoded };
    })
    .filter((part) => part.decoded && !/^--/.test(part.decoded));

  const plain = decodedParts.find((part) => part.contentType.includes("text/plain"));
  const html = decodedParts.find((part) => part.contentType.includes("text/html"));
  const fallback = decodedParts[0];
  const selected = plain || html || fallback;
  if (selected?.decoded) {
    if (looksLikeBase64Body(selected.decoded)) return cleanupTextBody(decodeTransferBody(selected.decoded, "base64"));
    return selected.decoded;
  }

  return cleanupTextBody(clean);
}

function categoryForText(text) {
  const normalized = text.toLowerCase();
  if (IMPORTANT_TERMS.some((term) => normalized.includes(term))) return "important";
  if (MARKETING_TERMS.some((term) => normalized.includes(term))) return "marketing";
  return "thinking";
}

function priorityForText(text) {
  const normalized = text.toLowerCase();
  if (IMPORTANT_TERMS.some((term) => normalized.includes(term))) return "high";
  if (MARKETING_TERMS.some((term) => normalized.includes(term))) return "low";
  return "medium";
}

function mapImapFetchToEmail(uid, raw) {
  const clean = stripImapLiterals(raw);
  const sender = parseSender(parseHeader(clean, "From"));
  const subject = parseHeader(clean, "Subject") || "(No subject)";
  const dateHeader = parseHeader(clean, "Date");
  const body = decodeMimeBody(clean);
  const snippet = body.slice(0, 140) || subject;
  const combined = `${subject} ${snippet}`;
  return {
    id: `qq-${uid}`,
    senderName: sender.senderName,
    senderEmail: sender.senderEmail,
    subject,
    snippet,
    body: body || snippet,
    dateLabel: shortDateLabel("", dateHeader),
    fallbackCategoryId: categoryForText(combined),
    priority: priorityForText(combined),
    summaryBullets: [snippet.slice(0, 90)],
    unread: true
  };
}

export async function listQqMessages(session) {
  const client = await createLineClient({ host: session.imapHost, port: session.imapPort });
  try {
    await client.readUntil((line) => line.startsWith("* OK"));
    client.write(`A1 LOGIN ${imapQuote(session.email)} ${imapQuote(session.authCode)}`);
    const loginLines = await client.readUntil((line) => /^A1 (OK|NO|BAD)/i.test(line));
    if (!/^A1 OK/i.test(loginLines.at(-1) || "")) throw new Error("QQ IMAP 登录已失效，请重新登录。");
    client.write("A2 SELECT INBOX");
    await client.readUntil((line) => /^A2 (OK|NO|BAD)/i.test(line));
    client.write("A3 UID SEARCH ALL");
    const searchLines = await client.readUntil((line) => /^A3 (OK|NO|BAD)/i.test(line));
    const uids = (searchLines.find((line) => line.startsWith("* SEARCH")) || "")
      .replace("* SEARCH", "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-30)
      .reverse();
    const emails = [];
    for (let index = 0; index < Math.min(uids.length, 20); index += 1) {
      const uid = uids[index];
      const tag = `B${index + 1}`;
      client.write(`${tag} UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[TEXT]<0.1200>)`);
      const lines = await client.readUntil((line) => new RegExp(`^${tag} (OK|NO|BAD)`, "i").test(line));
      emails.push(mapImapFetchToEmail(uid, lines.join("\n")));
    }
    client.write("C1 LOGOUT");
    return emails;
  } finally {
    client.end();
  }
}

function encodeHeader(value) {
  return /[^\x00-\x7F]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=` : value;
}

export function buildSmtpMessage({ to, from, subject, body }) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body.replace(/^\./gm, "..")
  ].join("\r\n");
}

export async function sendQqEmail(session, payload) {
  const client = await createLineClient({ host: session.smtpHost, port: session.smtpPort });
  try {
    expectSmtp(await readSmtpResponse(client), ["220"], "QQ SMTP 服务器无响应。");
    client.write("EHLO esmail.local");
    expectSmtp(await readSmtpResponse(client), ["250"], "QQ SMTP EHLO 失败。");
    await smtpAuth({ client, email: session.email, authCode: session.authCode });
    client.write(`MAIL FROM:<${session.email}>`);
    expectSmtp(await readSmtpResponse(client), ["250"], "发件人未被 QQ SMTP 接受。");
    client.write(`RCPT TO:<${payload.to}>`);
    expectSmtp(await readSmtpResponse(client), ["250", "251"], "收件人未被 QQ SMTP 接受。");
    client.write("DATA");
    expectSmtp(await readSmtpResponse(client), ["354"], "QQ SMTP 无法进入发送正文。");
    client.write(`${buildSmtpMessage({ ...payload, from: session.email })}\r\n.`);
    expectSmtp(await readSmtpResponse(client), ["250"], "QQ SMTP 发送失败。");
    client.write("QUIT");
    return { ok: true };
  } finally {
    client.end();
  }
}
