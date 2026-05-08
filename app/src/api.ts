import type { AccountSession, AssistantReply, Draft, Email, InboxAnalysis, Language } from "./types";

async function apiFetch<T>(url: string, init?: RequestInit, options: { timeoutMs?: number } = {}): Promise<T> {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  try {
    const response = await fetch(url, {
      ...init,
      signal: init?.signal || controller?.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${options.timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function assistantReplyFromText(text: string): AssistantReply {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\d.\s]+/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: "Esmail AI", lines: ["暂无回复。"] };
  }

  return {
    title: lines[0].replace(/[：:]$/, ""),
    lines: lines.slice(1, 4).length ? lines.slice(1, 4) : [lines[0]]
  };
}

export function getSession() {
  return apiFetch<AccountSession>("/api/session");
}

export function logoutGoogle() {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function loginQqMailbox(payload: {
  email: string;
  authCode: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}) {
  return apiFetch<{ ok: boolean; session: AccountSession }>("/api/auth/qq", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getGmailMessages() {
  const data = await apiFetch<{ emails: Email[] }>("/api/gmail/messages");
  return data.emails;
}

export async function getEmailMessage(messageId: string) {
  const data = await apiFetch<{ email: Email }>(`/api/gmail/messages/${encodeURIComponent(messageId)}`);
  return data.email;
}

export async function askAssistant(prompt: string, language: Language, emails: Email[] = []) {
  const data = await apiFetch<{ content: string }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ prompt, language, emails })
  }, { timeoutMs: 45_000 });
  return assistantReplyFromText(data.content);
}

export function createDraft(idea: string, language: string, tone: string) {
  return apiFetch<Draft>("/api/ai/draft", {
    method: "POST",
    body: JSON.stringify({ idea, language, tone })
  });
}

export async function analyzeInbox(emails: Email[], language: Language = "en") {
  const data = await apiFetch<{ analysis: InboxAnalysis[] }>("/api/ai/analyze-inbox", {
    method: "POST",
    body: JSON.stringify({ emails, language })
  });
  return data.analysis;
}

export function sendEmail(payload: { to: string; subject: string; body: string }) {
  return apiFetch<{ ok: boolean; id?: string }>("/api/gmail/send", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateGmailMessage(messageId: string, action: string) {
  return apiFetch<{ ok: boolean }>(`/api/gmail/messages/${encodeURIComponent(messageId)}/action`, {
    method: "POST",
    body: JSON.stringify({ action })
  });
}
