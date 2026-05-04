import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { buildChatPayload, buildContextualChatPrompt, callChatAnywhere, fallbackAnalysis, fallbackChatReply, fallbackDraft, parseJsonish, shouldAnswerFromInboxContext, soundsLikeMissingMailboxAccess, summarizeAnalysisPrompt } from "./ai.mjs";
import { normalizeCategoryIds, primaryCategoryId } from "./classification.mjs";
import { config } from "./env.mjs";
import { buildRawEmail, extractGmailImages, inlineImagesInHtml, mapGmailMessageToEmail } from "./gmail.mjs";
import { configureFetchProxy } from "./proxy.mjs";
import { getQqMessage, listQqMessages, sendQqEmail, verifyQqMailbox } from "./qqMail.mjs";
import { clearActiveProvider, clearQqSession, clearToken, readActiveProvider, readQqSession, readToken, withTokenStoreContext, writeActiveProvider, writeQqSession, writeToken } from "./tokenStore.mjs";

const cfg = config();
const fetchProxy = configureFetchProxy();
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send"
];

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": cfg.frontendOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function frontendRedirect(params = {}) {
  const url = new URL(cfg.frontendOrigin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function googleConnectionError(error) {
  const message = error?.message || "";
  const causeCode = error?.cause?.code || "";
  return message === "fetch failed" || causeCode === "UND_ERR_CONNECT_TIMEOUT";
}

function authErrorCode(error) {
  if (googleConnectionError(error)) return "google_network_timeout";
  return "google_auth_failed";
}

async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function authUrl() {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", cfg.googleClientId);
  url.searchParams.set("redirect_uri", cfg.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function exchangeCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.googleClientId,
      client_secret: cfg.googleClientSecret,
      redirect_uri: cfg.googleRedirectUri,
      grant_type: "authorization_code"
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google token exchange failed");
  return {
    ...data,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  };
}

async function refreshToken(token) {
  if (!token?.refresh_token) return token;
  if (token.expires_at && token.expires_at - Date.now() > 60_000) return token;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.googleClientId,
      client_secret: cfg.googleClientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google token refresh failed");
  const next = {
    ...token,
    ...data,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  };
  writeToken(next);
  return next;
}

async function googleFetch(path, options = {}) {
  const token = await refreshToken(readToken());
  if (!token?.access_token) {
    const error = new Error("Gmail is not connected");
    error.status = 401;
    throw error;
  }

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `Gmail request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function modifyGmailMessage(messageId, action) {
  if (action === "delete") {
    return googleFetch(`/messages/${encodeURIComponent(messageId)}/trash`, { method: "POST" });
  }

  const changes = {
    archive: { removeLabelIds: ["INBOX"] },
    star: { addLabelIds: ["STARRED"] },
    unstar: { removeLabelIds: ["STARRED"] },
    markUnread: { addLabelIds: ["UNREAD"] },
    markRead: { removeLabelIds: ["UNREAD"] },
    markNotImportant: { removeLabelIds: ["IMPORTANT"] }
  }[action];

  if (!changes) {
    const error = new Error("Unsupported Gmail message action");
    error.status = 400;
    throw error;
  }

  return googleFetch(`/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    body: JSON.stringify(changes)
  });
}

async function userProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  return response.json();
}

async function currentSession() {
  const activeProvider = readActiveProvider();
  const qqSession = readQqSession();

  if (activeProvider === "qq" && qqSession?.email) {
    return {
      authenticated: true,
      provider: "qq",
      email: qqSession.email,
      name: qqSession.name || qqSession.email.split("@")[0]
    };
  }

  const token = await refreshToken(readToken());
  if (token?.access_token) {
    return {
      authenticated: true,
      provider: "google",
      email: token.profile?.email || "",
      name: token.profile?.name || token.profile?.email || "Google",
      picture: token.profile?.picture || ""
    };
  }

  if (qqSession?.email) {
    return {
      authenticated: true,
      provider: "qq",
      email: qqSession.email,
      name: qqSession.name || qqSession.email.split("@")[0]
    };
  }

  return { authenticated: false };
}

async function attachGmailImages(message, email) {
  email.images = await extractGmailImages(message, async (attachmentId) => {
    const attachment = await googleFetch(`/messages/${message.id}/attachments/${attachmentId}`);
    return attachment.data || "";
  });
  email.htmlBody = inlineImagesInHtml(email.htmlBody || "", email.images);
  return email;
}

async function listMessages() {
  if (readActiveProvider() === "qq") {
    const qqSession = readQqSession();
    if (!qqSession?.email) {
      const error = new Error("QQ Mail is not connected");
      error.status = 401;
      throw error;
    }
    return listQqMessages(qqSession);
  }

  const list = await googleFetch("/messages?maxResults=200&q=newer_than:365d");
  const ids = list.messages || [];
  const messages = await Promise.all(
    ids.map((message) => googleFetch(`/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`))
  );
  return messages.map(mapGmailMessageToEmail);
}

async function getMessageDetail(messageId) {
  if (readActiveProvider() === "qq") {
    const qqSession = readQqSession();
    if (!qqSession?.email) {
      const error = new Error("QQ Mail is not connected");
      error.status = 401;
      throw error;
    }
    return getQqMessage(qqSession, messageId);
  }

  const message = await googleFetch(`/messages/${encodeURIComponent(messageId)}?format=full`);
  return attachGmailImages(message, mapGmailMessageToEmail(message));
}

async function aiChat(prompt, language, emails = []) {
  if (emails.length && shouldAnswerFromInboxContext(prompt)) {
    return fallbackChatReply(prompt, language, emails);
  }

  try {
    const reply = await callChatAnywhere({
      apiKey: cfg.chatAnywhereApiKey,
      baseUrl: cfg.chatAnywhereBaseUrl,
      model: cfg.aiModel,
      messages: [{ role: "user", content: buildContextualChatPrompt(prompt, emails, language) }],
      temperature: 0.25
    });
    if (emails.length && soundsLikeMissingMailboxAccess(reply)) {
      return fallbackChatReply(prompt, language, emails);
    }
    return reply;
  } catch (error) {
    return fallbackChatReply(prompt, language, emails);
  }
}

async function aiDraft({ idea, language, tone }) {
  const prompt = [
    "Create an email draft and return JSON only.",
    "Format: {\"subject\":\"...\",\"body\":\"...\"}",
    `Language: ${language}`,
    `Tone: ${tone}`,
    `Idea: ${idea}`
  ].join("\n");

  try {
    const text = await callChatAnywhere({
      apiKey: cfg.chatAnywhereApiKey,
      baseUrl: cfg.chatAnywhereBaseUrl,
      model: cfg.aiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.35
    });
    return parseJsonish(text, fallbackDraft({ idea, language, tone }));
  } catch {
    return fallbackDraft({ idea, language, tone });
  }
}

async function aiAnalyze(emails) {
  try {
    const text = await callChatAnywhere({
      apiKey: cfg.chatAnywhereApiKey,
      baseUrl: cfg.chatAnywhereBaseUrl,
      model: cfg.aiModel,
      messages: [{ role: "user", content: summarizeAnalysisPrompt(emails) }],
      temperature: 0.2
    });
    return normalizeAnalysis(parseJsonish(text, fallbackAnalysis(emails)), emails);
  } catch {
    return fallbackAnalysis(emails);
  }
}

function normalizeAnalysis(analysis, emails) {
  const fallback = fallbackAnalysis(emails);
  if (!Array.isArray(analysis)) return fallback;
  return analysis.map((item) => {
    const categoryIds = normalizeCategoryIds(item.categoryIds || item.categoryId);
    return {
      ...item,
      categoryIds: categoryIds.length ? categoryIds : normalizeCategoryIds(fallback.find((fallbackItem) => fallbackItem.id === item.id)?.categoryIds),
      categoryId: primaryCategoryId(categoryIds.length ? categoryIds : fallback.find((fallbackItem) => fallbackItem.id === item.id)?.categoryIds),
      summaryBullets: Array.isArray(item.summaryBullets) ? item.summaryBullets.slice(0, 3).map(String) : []
    };
  });
}

export async function handleApi(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  try {
    if (url.pathname === "/api/auth/google") {
      return redirect(res, authUrl());
    }

    if (url.pathname === "/api/auth/google/callback") {
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Missing Google OAuth code");
      const token = await exchangeCode(code);
      token.profile = await userProfile(token.access_token);
      writeToken(token);
      writeActiveProvider("google");
      return redirect(res, frontendRedirect({ connected: "google" }));
    }

    if (url.pathname === "/api/auth/qq" && req.method === "POST") {
      const body = await readJson(req);
      const settings = {
        email: String(body.email || "").trim(),
        authCode: String(body.authCode || "").trim(),
        imapHost: "imap.qq.com",
        imapPort: 993,
        smtpHost: "smtp.qq.com",
        smtpPort: 465
      };
      if (!settings.email || !settings.authCode) {
        const error = new Error("请填写 QQ 邮箱和授权码。");
        error.status = 400;
        throw error;
      }
      await verifyQqMailbox(settings, { verifySmtp: false });
      writeQqSession({
        ...settings,
        provider: "qq",
        name: settings.email.split("@")[0],
        connectedAt: new Date().toISOString()
      });
      writeActiveProvider("qq");
      return sendJson(res, 200, {
        ok: true,
        session: {
          authenticated: true,
          provider: "qq",
          email: settings.email,
          name: settings.email.split("@")[0]
        }
      });
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      clearToken();
      clearQqSession();
      clearActiveProvider();
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/session") {
      return sendJson(res, 200, await currentSession());
    }

    if (url.pathname === "/api/gmail/messages") {
      return sendJson(res, 200, { emails: await listMessages() });
    }

    const detailMatch = url.pathname.match(/^\/api\/gmail\/messages\/([^/]+)$/);
    if (detailMatch && req.method === "GET") {
      return sendJson(res, 200, { email: await getMessageDetail(decodeURIComponent(detailMatch[1])) });
    }

    if (url.pathname === "/api/gmail/send" && req.method === "POST") {
      const body = await readJson(req);
      const session = await currentSession();
      if (session.provider === "qq") {
        const qqSession = readQqSession();
        const sent = await sendQqEmail(qqSession, {
          to: body.to,
          subject: body.subject,
          body: body.body
        });
        return sendJson(res, 200, sent);
      }
      const raw = buildRawEmail({
        to: body.to,
        from: session.email || "me",
        subject: body.subject,
        body: body.body
      });
      const sent = await googleFetch("/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw })
      });
      return sendJson(res, 200, { ok: true, id: sent.id });
    }

    const modifyMatch = url.pathname.match(/^\/api\/gmail\/messages\/([^/]+)\/action$/);
    if (modifyMatch && req.method === "POST") {
      const body = await readJson(req);
      await modifyGmailMessage(decodeURIComponent(modifyMatch[1]), body.action);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/ai/chat" && req.method === "POST") {
      const body = await readJson(req);
      const content = await aiChat(body.prompt || "", body.language || "zh", body.emails || []);
      return sendJson(res, 200, { content });
    }

    if (url.pathname === "/api/ai/draft" && req.method === "POST") {
      const body = await readJson(req);
      return sendJson(res, 200, await aiDraft(body));
    }

    if (url.pathname === "/api/ai/analyze-inbox" && req.method === "POST") {
      const body = await readJson(req);
      return sendJson(res, 200, { analysis: await aiAnalyze(body.emails || []) });
    }

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, model: cfg.aiModel });
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    if (url.pathname === "/api/auth/google/callback") {
      console.error("Google OAuth callback failed:", error);
      return redirect(
        res,
        frontendRedirect({
          auth_error: authErrorCode(error),
          auth_detail: error?.message || "Google OAuth failed"
        })
      );
    }
    sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
}

if (!process.env.VERCEL && process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer((req, res) => withTokenStoreContext(req, res, () => handleApi(req, res)));

  server.listen(cfg.apiPort, "127.0.0.1", () => {
    console.log(`Esmail API ready at http://127.0.0.1:${cfg.apiPort}`);
    if (fetchProxy) console.log(`Google API requests use proxy: ${fetchProxy}`);
    console.log(`Chat payload model: ${buildChatPayload({ model: cfg.aiModel, messages: [] }).model}`);
  });
}
