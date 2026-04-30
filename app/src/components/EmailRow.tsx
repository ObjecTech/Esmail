import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { categoryLabel } from "../language";
import type { Category, Email, Language, Todo } from "../types";

interface EmailRowProps {
  category?: Category;
  email: Email;
  language: Language;
  todo?: Todo;
  onOpen: (email: Email) => void;
}

export function EmailRow({ category, email, language, todo, onOpen }: EmailRowProps) {
  return (
    <button className="email-row" onClick={() => onOpen(email)} type="button">
      <div className="sender-avatar" style={{ "--avatar": category?.color || "#52b7ff" } as CSSProperties}>
        {email.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className="email-row-main">
        <div className="email-row-top">
          <span className="sender-name">{email.senderName}</span>
          <span className="email-date">{email.dateLabel}</span>
        </div>
        <div className="email-subject">{email.subject}</div>
        <div className="email-snippet">{todo ? `待办：${todo.title}` : email.snippet}</div>
        <div className="email-tags">
          {category ? <span className="mini-tag" style={{ color: category.color }}>{categoryLabel(category, language)}</span> : null}
          {todo ? <span className="mini-tag todo-tag">{language === "zh" ? "已生成待办" : "Todo created"}</span> : null}
          {email.matchedRuleId ? <span className="mini-tag">{language === "zh" ? "规则匹配" : "Rule"}</span> : null}
        </div>
      </div>
      <ChevronRight className="email-chevron" size={18} />
    </button>
  );
}
