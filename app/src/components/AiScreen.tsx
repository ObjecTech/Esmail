import { ArrowUp, Clock, Mic, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAssistantReply } from "../ai";
import type { AssistantReply, Language } from "../types";
import { IconButton } from "./IconButton";

const suggestions: Record<Language, string[]> = {
  zh: ["整理我今天的日程", "用几句话总结我的写信风格", "总结今天未读的重要邮件"],
  en: ["Plan my day from email", "Summarize my writing style", "Summarize important unread emails"]
};

interface AiScreenProps {
  language: Language;
  onAskAssistant: (prompt: string) => Promise<AssistantReply>;
}

export function AiScreen({ language, onAskAssistant }: AiScreenProps) {
  const [prompt, setPrompt] = useState("");
  const defaultPrompt = language === "zh" ? "总结今天未读的重要邮件" : "Summarize important unread emails";
  const localizedSuggestions = useMemo(() => suggestions[language], [language]);
  const [reply, setReply] = useState(() => getAssistantReply(defaultPrompt, language));
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    setReply(getAssistantReply(defaultPrompt, language));
  }, [defaultPrompt, language]);

  async function submit(value: string) {
    const nextPrompt = value.trim();
    if (!nextPrompt) return;
    setIsThinking(true);
    try {
      setReply(await onAskAssistant(nextPrompt));
    } finally {
      setIsThinking(false);
    }
    setPrompt("");
  }

  return (
    <section className="screen-section ai-screen">
      <header className="ai-top-actions">
        <span />
        <div>
          <IconButton label={language === "zh" ? "新增 AI 任务" : "New AI task"}>
            <Plus size={27} />
          </IconButton>
          <IconButton label={language === "zh" ? "历史" : "History"}>
            <Clock size={25} />
          </IconButton>
        </div>
      </header>

      <div className="ai-hero">
        <h1>{language === "zh" ? "Hi 青内" : "Hi Qingnei"}</h1>
        <p>{language === "zh" ? "收件箱积压太多？我可以帮忙。" : "Too much in your inbox? I can help."}</p>
      </div>

      <div className="ai-suggestions">
        {localizedSuggestions.map((item) => (
          <button key={item} onClick={() => void submit(item)} type="button">
            <Sparkles size={18} />
            <span>{item}</span>
          </button>
        ))}
      </div>

      <div className="ai-reply">
        <h2>{isThinking ? (language === "zh" ? "Esmail AI 正在思考" : "Esmail AI is thinking") : reply.title}</h2>
        <ul>
          {(isThinking ? [language === "zh" ? "正在读取请求并生成简短结果..." : "Reading your request and keeping it concise..."] : reply.lines).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

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
        <button className="round-input-action" type="button" aria-label={language === "zh" ? "语音输入" : "Voice input"}>
          <Mic size={22} />
        </button>
        <button className="round-input-action send-action" type="submit" aria-label={language === "zh" ? "发送" : "Send"}>
          <ArrowUp size={22} />
        </button>
      </form>
    </section>
  );
}
