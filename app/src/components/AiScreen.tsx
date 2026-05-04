import { ArrowUp, ChevronLeft, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { findRelevantEmailCitations, isSearchLikePrompt } from "../ai";
import type { AiChatMessage, AiConversation, AssistantReply, Email, Language } from "../types";
import { IconButton } from "./IconButton";

const historyStorageKey = "esmail.ai.history.v1";

const suggestions: Record<Language, string[]> = {
  zh: ["总结今天未读的重要邮件"],
  en: ["Summarize important unread emails"]
};

interface AiScreenProps {
  language: Language;
  emails?: Email[];
  onAskAssistant: (prompt: string) => Promise<AssistantReply>;
  onOpenEmail?: (email: Email) => void;
}

function loadHistory(): AiConversation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (item?.messages?.length) return item;
        if (item?.id && item?.prompt && item?.reply?.title && Array.isArray(item?.reply?.lines)) {
          return {
            id: item.id,
            title: item.prompt,
            messages: [
              {
                id: `${item.id}-user`,
                role: "user",
                content: item.prompt,
                createdAt: item.updatedAt || Date.now()
              },
              {
                id: `${item.id}-assistant`,
                role: "assistant",
                content: item.reply.title,
                reply: item.reply,
                createdAt: item.updatedAt || Date.now()
              }
            ],
            updatedAt: item.updatedAt || Date.now()
          };
        }
        return null;
      })
      .filter((item): item is AiConversation => Boolean(item?.id && item?.title && Array.isArray(item?.messages)))
      .slice(0, 30);
  } catch {
    return [];
  }
}

function saveHistory(items: AiConversation[]) {
  localStorage.setItem(historyStorageKey, JSON.stringify(items.slice(0, 30)));
}

export function AiScreen({ language, emails = [], onAskAssistant, onOpenEmail }: AiScreenProps) {
  const [prompt, setPrompt] = useState("");
  const localizedSuggestions = useMemo(() => suggestions[language], [language]);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [history, setHistory] = useState<AiConversation[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [expandedCitationIds, setExpandedCitationIds] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  async function submit(value: string) {
    const nextPrompt = value.trim();
    if (!nextPrompt) return;
    setShowHistory(false);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const now = Date.now();
    const conversationId = activeConversationId || `ai-${now}`;
    const userMessage: AiChatMessage = {
      id: `${conversationId}-user-${now}`,
      role: "user",
      content: nextPrompt,
      createdAt: now
    };
    const nextMessages = [...messages, userMessage];
    setActiveConversationId(conversationId);
    setMessages(nextMessages);
    setIsThinking(true);
    setPrompt("");
    try {
      const nextReply = await onAskAssistant(nextPrompt);
      if (requestIdRef.current === requestId) {
        const citationQuery = [nextPrompt, nextReply.title, ...nextReply.lines].join("\n");
        const citations = findRelevantEmailCitations(citationQuery, emails, language);
        const assistantMessage: AiChatMessage = {
          id: `${conversationId}-assistant-${Date.now()}`,
          role: "assistant",
          content: nextReply.title,
          reply: nextReply,
          citations,
          showMoreSearch: citations.length < 3 && isSearchLikePrompt(nextPrompt, language),
          createdAt: Date.now()
        };
        const completedMessages = [...nextMessages, assistantMessage];
        setMessages(completedMessages);
        rememberConversation(conversationId, nextPrompt, completedMessages);
      }
    } finally {
      if (requestIdRef.current === requestId) setIsThinking(false);
    }
  }

  function startNewConversation() {
    requestIdRef.current += 1;
    setPrompt("");
    setMessages([]);
    setIsThinking(false);
    setShowHistory(false);
    setActiveConversationId(null);
    setExpandedCitationIds([]);
  }

  function rememberConversation(conversationId: string, nextPrompt: string, nextMessages: AiChatMessage[]) {
    setHistory((current) => {
      const saved: AiConversation = {
        id: conversationId,
        title: nextMessages.find((message) => message.role === "user")?.content || nextPrompt,
        messages: nextMessages,
        updatedAt: Date.now()
      };
      const next = [saved, ...current.filter((item) => item.id !== conversationId)].slice(0, 30);
      saveHistory(next);
      return next;
    });
  }

  function openConversation(conversation: AiConversation) {
    requestIdRef.current += 1;
    setPrompt("");
    setMessages(conversation.messages);
    setIsThinking(false);
    setShowHistory(false);
    setActiveConversationId(conversation.id);
    setExpandedCitationIds([]);
  }

  function deleteConversation(conversationId: string) {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== conversationId);
      saveHistory(next);
      return next;
    });
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setMessages([]);
      setPrompt("");
      setIsThinking(false);
      setExpandedCitationIds([]);
    }
  }

  function toggleCitation(citationId: string) {
    setExpandedCitationIds((current) =>
      current.includes(citationId) ? current.filter((id) => id !== citationId) : [...current, citationId]
    );
  }

  const inputForm = (
    <form
      className="ai-input-box"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(prompt);
      }}
    >
      <Sparkles size={18} />
      <input
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={language === "zh" ? "搜索、写作或询问任何内容..." : "Search, write, or ask anything..."}
        value={prompt}
      />
      <button className="round-input-action send-action" type="submit" aria-label={language === "zh" ? "发送" : "Send"}>
        <ArrowUp size={23} strokeWidth={2.8} />
      </button>
    </form>
  );

  if (showHistory) {
    return (
      <section className="screen-section ai-screen ai-history-screen">
        <header className="ai-history-header">
          <div>
            <h1>{language === "zh" ? "历史对话" : "Chat history"}</h1>
          </div>
          <IconButton label={language === "zh" ? "返回 AI" : "Back to AI"} onClick={() => setShowHistory(false)}>
            <ChevronLeft size={30} />
          </IconButton>
        </header>

        <div className="ai-history-list">
          {history.length ? (
            history.map((conversation) => (
              <div className="ai-history-row" key={conversation.id}>
                <button className="ai-history-open" onClick={() => openConversation(conversation)} type="button">
                  <Clock size={26} />
                  <span>{conversation.title}</span>
                </button>
                <button
                  aria-label={language === "zh" ? `删除历史对话：${conversation.title}` : `Delete chat history: ${conversation.title}`}
                  className="ai-history-delete"
                  onClick={() => deleteConversation(conversation.id)}
                  type="button"
                >
                  <Trash2 size={22} />
                </button>
              </div>
            ))
          ) : (
            <p className="ai-history-empty">{language === "zh" ? "暂无历史对话" : "No saved conversations yet"}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="screen-section ai-screen">
      <header className="ai-top-actions">
        <span />
        <div>
          <IconButton label={language === "zh" ? "新增 AI 任务" : "New AI task"} onClick={startNewConversation}>
            <Plus size={27} />
          </IconButton>
          <IconButton label={language === "zh" ? "历史" : "History"} onClick={() => setShowHistory(true)}>
            <Clock size={25} />
          </IconButton>
        </div>
      </header>

      <div className="ai-hero">
        <h1>Hi</h1>
        <p>{language === "zh" ? "收件箱积压太多？我可以帮忙。" : "Too much in your inbox? I can help."}</p>
      </div>

      {!messages.length ? <div className="ai-suggestions">
        {localizedSuggestions.map((item) => (
          <button key={item} onClick={() => void submit(item)} type="button">
            <Sparkles size={18} />
            <span>{item}</span>
          </button>
        ))}
      </div> : null}

      {messages.length || isThinking ? (
        <div className="ai-chat-thread" aria-label={language === "zh" ? "AI 对话" : "AI conversation"}>
          {messages.map((message) => (
            <div key={message.id} className={`ai-message ai-message-${message.role}`}>
              {message.role === "user" ? (
                <p>{message.content}</p>
              ) : (
                <>
                  <h2>{message.reply?.title || message.content}</h2>
                  <ul>
                    {(message.reply?.lines || []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {message.citations?.length ? (
                    <div className="ai-citation-list">
                      {message.citations.map((citation) => {
                        const citationId = `${message.id}-${citation.email.id}`;
                        const expanded = expandedCitationIds.includes(citationId);
                        return (
                          <article className="ai-citation-card" key={citation.email.id}>
                            <div className="ai-citation-main">
                              <div>
                                <h3>{citation.email.subject}</h3>
                                <p>{citation.email.senderName} · {citation.email.dateLabel}</p>
                              </div>
                              <strong>{citation.matchLabel}</strong>
                            </div>
                            <p>{citation.excerpt}</p>
                            <div className="ai-citation-actions">
                              <button onClick={() => onOpenEmail?.(citation.email)} type="button">
                                {language === "zh" ? "打开邮件" : "Open email"}
                              </button>
                              <button onClick={() => toggleCitation(citationId)} type="button">
                                {expanded ? (language === "zh" ? "收起片段" : "Collapse snippet") : (language === "zh" ? "展开片段" : "Expand snippet")}
                              </button>
                            </div>
                            {expanded ? (
                              <div className="ai-citation-expanded">
                                <p>{citation.email.senderName} · {citation.email.dateLabel}</p>
                                <ul>
                                  {citation.summaryBullets.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                                <blockquote>{citation.excerpt}</blockquote>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                  {message.showMoreSearch ? (
                    <button className="ai-more-search" type="button">
                      {language === "zh" ? "继续搜索更多邮件" : "Search more mail"}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ))}
          {isThinking ? (
            <div className="ai-message ai-message-assistant ai-message-thinking">
              <h2>{language === "zh" ? "Esmail AI 正在思考" : "Esmail AI is thinking"}</h2>
              <p>{language === "zh" ? "正在读取请求并生成简短结果..." : "Reading your request and keeping it concise..."}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {inputForm}
    </section>
  );
}
