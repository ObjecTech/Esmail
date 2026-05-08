import tls from "node:tls";
import { TextDecoder } from "node:util";
import { classifyEmailText, primaryCategoryId, priorityForCategories } from "./classification.mjs";
import { shortDateLabel } from "./gmail.mjs";

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
      buffer += chunk.toString("binary");
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

export async function verifyQqMailbox(settings, options = {}) {
  await verifyImapLogin(settings);
  if (options.verifySmtp !== false) await verifySmtpLogin(settings);
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
  const match = headerValueRaw(headers, "Content-Type").match(/charset\s*=\s*("?[^";\r\n]+"?)/i);
  return normalizeCharset(match?.[1] || "utf-8");
}

function transferEncodingFromHeaders(headers = "") {
  return (headerValueRaw(headers, "Content-Transfer-Encoding") || "7bit").trim().toLowerCase();
}

function headerValueRaw(raw, name) {
  const match = raw.match(new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n[^\\s]|$)`, "im"));
  return (match?.[1] || "").replace(/\r?\n\s+/g, " ").trim();
}

function contentTypeFromHeaders(headers = "") {
  return headerValueRaw(headers, "Content-Type").split(";")[0].trim().toLowerCase();
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
  const normalizedEncodedBreaks = value.replace(/=(?:0D=0A|0A|0D)\r?\n/gi, (match) => match.replace(/\r?\n$/, ""));
  const softUnwrapped = normalizedEncodedBreaks.replace(/=\r?\n/g, "");
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
  return decodeBytes(Buffer.from(value, "binary"), charset);
}

function cleanupTextBody(value = "") {
  return sanitizeHtml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
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
  const contentType = headerValueRaw(headers, "Content-Type");
  return contentType.match(/boundary\s*=\s*"([^"]+)"/i)?.[1] || contentType.match(/boundary\s*=\s*([^;\r\n]+)/i)?.[1]?.trim();
}

function boundaryFromBody(body = "") {
  const match = body.match(/(?:^|\r?\n)--([^\r\n-][^\r\n]*)\r?\n(?=(?:[A-Za-z-]+:\s*[^\r\n]*\r?\n)+\r?\n)/);
  return match?.[1]?.trim();
}

function splitMultipart(body = "", boundary = "") {
  if (!boundary) return [];
  return body
    .split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\s*`, "g"))
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectMimeParts(raw = "", fallbackHeaders = "") {
  const headerlessBoundary = !fallbackHeaders ? boundaryFromBody(raw) : "";
  if (headerlessBoundary) {
    return splitMultipart(raw, headerlessBoundary).flatMap((part) => collectMimeParts(part));
  }

  const section = splitHeaderAndBody(raw);
  const headers = section.headers || fallbackHeaders;
  const body = section.body;
  const contentType = contentTypeFromHeaders(headers);
  const boundary = boundaryFromHeaders(headers) || boundaryFromBody(body);

  if (boundary) {
    return splitMultipart(body, boundary).flatMap((part) => collectMimeParts(part));
  }

  return [{ headers, body, contentType }];
}

function decodeTextPart(part) {
  const charset = charsetFromHeaders(part.headers);
  const transferEncoding = transferEncodingFromHeaders(part.headers);
  return decodeTransferBody(part.body, transferEncoding, charset);
}

function hasMimeStructure(raw = "", parts = []) {
  return Boolean(
    boundaryFromBody(raw) ||
    /^content-(type|transfer-encoding|disposition|id):/im.test(raw) ||
    parts.some((part) => part.contentType || /^content-(type|transfer-encoding|disposition|id):/im.test(part.headers))
  );
}

function looksLikeBinaryContent(value = "") {
  const sample = value.slice(0, 2048);
  if (!sample) return false;
  if (/^\x89PNG\r?\n\x1a\n/.test(sample) || /^\xff\xd8\xff/.test(sample) || /^GIF8[79]a/.test(sample) || /^RIFF[\s\S]{4}WEBP/.test(sample)) return true;
  let controls = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127 || code === 65533) controls += 1;
  }
  return controls / sample.length > 0.03;
}

function isReadableTextPart(part) {
  if (part.contentType) return part.contentType.startsWith("text/");
  if (/^content-(type|transfer-encoding|disposition|id):/im.test(part.headers)) return false;
  return !looksLikeBinaryContent(part.body);
}

function imageMimeFromBytes(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.slice(1, 4).toString("ascii") === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.slice(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.slice(0, 4).toString("ascii") === "RIFF" && bytes.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function normalizeImageMimeType(mimeType = "") {
  const normalized = String(mimeType).split(";")[0].trim().toLowerCase();
  if (!normalized.startsWith("image/")) return "";
  return {
    "image/jpg": "image/jpeg",
    "image/jpe": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png"
  }[normalized] || normalized;
}

function imageMimeFromFilename(filename = "") {
  const extension = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml"
  }[extension] || "";
}

function decodePartBytes(part) {
  const transferEncoding = transferEncodingFromHeaders(part.headers);
  return transferEncoding === "base64"
    ? Buffer.from(part.body.replace(/\s+/g, ""), "base64")
    : Buffer.from(part.body, "binary");
}

function tokenizeBodyStructure(value = "") {
  const tokens = [];
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (char === '"') {
      let text = "";
      index += 1;
      while (index < value.length) {
        if (value[index] === "\\" && index + 1 < value.length) {
          text += value[index + 1];
          index += 2;
          continue;
        }
        if (value[index] === '"') {
          index += 1;
          break;
        }
        text += value[index];
        index += 1;
      }
      tokens.push(text);
      continue;
    }
    const start = index;
    while (index < value.length && !/[\s()]/.test(value[index])) index += 1;
    tokens.push(value.slice(start, index));
  }
  return tokens;
}

function parseBodyStructureTokens(tokens) {
  let index = 0;
  function parseValue() {
    const token = tokens[index];
    index += 1;
    if (token === "(") {
      const items = [];
      while (index < tokens.length && tokens[index] !== ")") items.push(parseValue());
      index += 1;
      return items;
    }
    if (/^NIL$/i.test(String(token))) return null;
    return token;
  }
  return parseValue();
}

function extractBodyStructureExpression(raw = "") {
  const marker = raw.search(/\bBODYSTRUCTURE\b/i);
  if (marker < 0) return "";
  const start = raw.indexOf("(", marker);
  if (start < 0) return "";
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return "";
}

function bodyStructureParamValue(params, key) {
  if (!Array.isArray(params)) return "";
  for (let index = 0; index < params.length - 1; index += 2) {
    if (String(params[index]).toLowerCase() === key.toLowerCase()) return decodeMimeWords(String(params[index + 1] || ""));
  }
  return "";
}

function bodyStructureFilename(part) {
  const name = bodyStructureParamValue(part[2], "name");
  const dispositionParams = Array.isArray(part[8]) ? part[8][1] : null;
  return bodyStructureParamValue(dispositionParams, "filename") || name;
}

export function extractBodyStructureImages(raw = "") {
  const expression = extractBodyStructureExpression(raw);
  if (!expression) return [];
  const parsed = parseBodyStructureTokens(tokenizeBodyStructure(expression));
  const images = [];

  function walk(node, prefix = "") {
    if (!Array.isArray(node) || !node.length) return;
    if (typeof node[0] === "string" && typeof node[1] === "string") {
      const mimeType = normalizeImageMimeType(`image/${node[1]}`);
      if (String(node[0]).toLowerCase() === "image" && mimeType) {
        images.push({
          partNumber: prefix,
          filename: bodyStructureFilename(node) || `image-${images.length + 1}`,
          mimeType,
          contentId: String(node[3] || "").replace(/^<|>$/g, "")
        });
      }
      return;
    }

    let childIndex = 0;
    for (const child of node) {
      if (!Array.isArray(child)) break;
      childIndex += 1;
      walk(child, prefix ? `${prefix}.${childIndex}` : String(childIndex));
    }
  }

  walk(parsed);
  return images;
}

function bodyFromFetchResponse(raw = "") {
  return stripImapLiterals(raw)
    .replace(/^\* \d+ FETCH[^\r\n]*\r?\n/i, "")
    .replace(/\r?\n\)\s*$/g, "")
    .trim();
}

export function bodyStructureImageFromFetch(part, raw = "", options = {}) {
  const maxBytes = options.maxBytes || 2_000_000;
  const body = bodyFromFetchResponse(raw).replace(/\s+/g, "");
  if (!body) return null;
  const bytes = Buffer.from(body, "base64");
  if (!bytes.length || bytes.length > maxBytes) return null;
  const mimeType = normalizeImageMimeType(part.mimeType) || imageMimeFromBytes(bytes) || imageMimeFromFilename(part.filename);
  if (!mimeType) return null;
  return {
    filename: part.filename,
    mimeType,
    contentId: part.contentId,
    disposition: "inline",
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`
  };
}

function splitFetchResponses(raw = "") {
  return raw
    .split(/(?=^\* \d+ FETCH\b)/gim)
    .map((item) => item.trim())
    .filter((item) => /^\* \d+ FETCH\b/i.test(item));
}

function uidFromFetch(raw = "") {
  return raw.match(/\bUID\s+(\d+)\b/i)?.[1] || "";
}

export function decodeMimeBody(raw = "") {
  return decodeMimeContent(raw).text;
}

export function decodeMimeContent(raw = "") {
  const clean = stripImapLiterals(raw);
  if (!/\r?\n\r?\n/.test(clean) && /^from:|^subject:|^date:/im.test(clean)) {
    return { text: "", htmlBody: "" };
  }
  if (looksLikeBase64Body(clean)) {
    return { text: cleanupTextBody(decodeTransferBody(clean, "base64")), htmlBody: "" };
  }

  const parts = collectMimeParts(clean);
  const decodedParts = parts
    .filter(isReadableTextPart)
    .map((part) => ({
      contentType: part.contentType,
      decoded: decodeTextPart(part)
    }))
    .filter((part) => part.decoded && !/^--/.test(part.decoded) && !looksLikeBinaryContent(part.decoded));

  const plain = decodedParts.find((part) => part.contentType.includes("text/plain"));
  const html = decodedParts.find((part) => part.contentType.includes("text/html"));
  const htmlBody = html?.decoded ? sanitizeHtml(html.decoded) : "";
  const fallback = decodedParts[0]?.decoded || "";
  const text = plain?.decoded ? cleanupTextBody(plain.decoded) : cleanupTextBody(htmlBody || fallback);
  if (text || htmlBody) return { text, htmlBody };
  if (hasMimeStructure(clean, parts) || looksLikeBinaryContent(clean)) return { text: "", htmlBody: "" };
  return { text: cleanupTextBody(clean), htmlBody: "" };
}

function extractFilename(headers = "") {
  const filename = headers.match(/filename\*?=(?:"([^"]+)"|([^;\r\n]+))/i)?.[1] || headers.match(/filename\*?=(?:"([^"]+)"|([^;\r\n]+))/i)?.[2];
  if (!filename) return "";
  return decodeMimeWords(filename.trim().replace(/^utf-8''/i, "").replace(/^"|"$/g, ""));
}

export function extractMimeImages(raw = "", options = {}) {
  const maxImages = options.maxImages || 8;
  const maxBytes = options.maxBytes || 2_000_000;
  const clean = stripImapLiterals(raw);
  const parts = collectMimeParts(clean);
  const images = [];

  for (const part of parts) {
    if (images.length >= maxImages) break;
    const partHeaders = part.headers;
    const contentId = (parseHeader(partHeaders, "Content-ID") || "").replace(/^<|>$/g, "");
    const filename = extractFilename(partHeaders) || contentId || `image-${images.length + 1}`;
    const bytes = decodePartBytes(part);
    const mimeType = normalizeImageMimeType(part.contentType) || imageMimeFromBytes(bytes) || imageMimeFromFilename(filename);
    if (!mimeType) continue;
    if (!bytes.length || bytes.length > maxBytes) continue;
    images.push({
      filename,
      mimeType,
      contentId,
      disposition: parseHeader(partHeaders, "Content-Disposition"),
      dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`
    });
  }

  if (!images.length) {
    const bytes = Buffer.from(clean, "binary");
    const mimeType = imageMimeFromBytes(bytes);
    if (mimeType && bytes.length <= maxBytes) {
      images.push({
        filename: `image-${images.length + 1}`,
        mimeType,
        contentId: "",
        disposition: "inline",
        dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`
      });
    }
  }

  return images;
}

function hasMimeAttachment(raw = "") {
  return /content-disposition:\s*attachment/i.test(raw) || /filename\*?=/i.test(raw);
}

function inlineImagesInHtml(htmlBody = "", images = []) {
  let html = htmlBody || "";
  for (const image of images) {
    if (!image.contentId || !image.dataUrl) continue;
    const escaped = image.contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`cid:${escaped}`, "gi"), image.dataUrl);
  }
  return html;
}

function mapImapFetchToEmail(uid, raw, options = {}) {
  const clean = stripImapLiterals(raw);
  const sender = parseSender(parseHeader(clean, "From"));
  const to = parseHeader(clean, "To");
  const cc = parseHeader(clean, "Cc");
  const subject = parseHeader(clean, "Subject") || "(No subject)";
  const dateHeader = parseHeader(clean, "Date");
  const content = decodeMimeContent(clean);
  const body = content.text;
  const snippet = body.slice(0, 140) || subject;
  const combined = `${subject} ${snippet}`;
  const fallbackCategoryIds = classifyEmailText({
    from: `${sender.senderName} ${sender.senderEmail}`,
    subject,
    snippet,
    body
  });
  const fallbackCategoryId = primaryCategoryId(fallbackCategoryIds);
  const images = options.includeImages === false ? [] : extractMimeImages(clean);
  return {
    id: `qq-${uid}`,
    senderName: sender.senderName,
    senderEmail: sender.senderEmail,
    to,
    cc,
    subject,
    snippet,
    body: body || snippet,
    htmlBody: inlineImagesInHtml(content.htmlBody, images),
    dateLabel: shortDateLabel("", dateHeader),
    fallbackCategoryIds,
    categoryIds: fallbackCategoryIds,
    fallbackCategoryId,
    categoryId: fallbackCategoryId,
    priority: priorityForCategories(fallbackCategoryIds, combined),
    summaryBullets: [snippet.slice(0, 90)],
    images,
    unread: true,
    hasAttachments: hasMimeAttachment(clean)
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
      .slice(-200)
      .reverse();
    const emailsByUid = new Map();
    const batchSize = 50;
    for (let index = 0; index < uids.length; index += batchSize) {
      const batch = uids.slice(index, index + batchSize);
      const tag = `B${Math.floor(index / batchSize) + 1}`;
      client.write(`${tag} UID FETCH ${batch.join(",")} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
      const lines = await client.readUntil((line) => new RegExp(`^${tag} (OK|NO|BAD)`, "i").test(line), 24_000);
      for (const response of splitFetchResponses(lines.join("\n"))) {
        const uid = uidFromFetch(response);
        if (uid) emailsByUid.set(uid, mapImapFetchToEmail(uid, response, { includeImages: false }));
      }
    }
    client.write("C1 LOGOUT");
    return uids.map((uid) => emailsByUid.get(uid)).filter(Boolean);
  } finally {
    client.end();
  }
}

export async function getQqMessage(session, messageId) {
  const uid = String(messageId || "").replace(/^qq-/, "");
  if (!/^\d+$/.test(uid)) {
    const error = new Error("Invalid QQ message id");
    error.status = 400;
    throw error;
  }

  const client = await createLineClient({ host: session.imapHost, port: session.imapPort });
  try {
    await client.readUntil((line) => line.startsWith("* OK"));
    client.write(`A1 LOGIN ${imapQuote(session.email)} ${imapQuote(session.authCode)}`);
    const loginLines = await client.readUntil((line) => /^A1 (OK|NO|BAD)/i.test(line));
    if (!/^A1 OK/i.test(loginLines.at(-1) || "")) throw new Error("QQ IMAP 登录已失效，请重新登录。");
    client.write("A2 SELECT INBOX");
    await client.readUntil((line) => /^A2 (OK|NO|BAD)/i.test(line));
    client.write(`A3 UID FETCH ${uid} (BODYSTRUCTURE)`);
    const structureLines = await client.readUntil((line) => /^A3 (OK|NO|BAD)/i.test(line), 30_000);
    client.write(`A4 UID FETCH ${uid} (BODY.PEEK[])`);
    const lines = await client.readUntil((line) => /^A4 (OK|NO|BAD)/i.test(line), 30_000);
    const email = mapImapFetchToEmail(uid, lines.join("\n"), { includeImages: true });
    const existingContentIds = new Set((email.images || []).map((image) => image.contentId).filter(Boolean));
    const unresolvedContentIds = new Set(
      [...String(email.htmlBody || "").matchAll(/cid:([^"'\s>]+)/gi)]
        .map((match) => decodeURIComponent(match[1]).replace(/^<|>$/g, ""))
    );
    const missingParts = extractBodyStructureImages(structureLines.join("\n")).filter((part) => {
      if (!part.contentId || existingContentIds.has(part.contentId)) return false;
      return unresolvedContentIds.has(part.contentId);
    });
    for (let index = 0; index < missingParts.length; index += 1) {
      const part = missingParts[index];
      const tag = `A${5 + index}`;
      client.write(`${tag} UID FETCH ${uid} (BODY.PEEK[${part.partNumber}])`);
      const partLines = await client.readUntil((line) => new RegExp(`^${tag} (OK|NO|BAD)`, "i").test(line), 30_000);
      const image = bodyStructureImageFromFetch(part, partLines.join("\n"));
      if (!image) continue;
      email.images.push(image);
      existingContentIds.add(image.contentId);
    }
    email.htmlBody = inlineImagesInHtml(email.htmlBody || "", email.images);
    client.write(`A${5 + missingParts.length} LOGOUT`);
    return email;
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
