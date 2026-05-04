import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { categoryLabel } from "../language";
import { isUnreadEmail } from "../mailState";
import type { Category, Email, Language, Todo } from "../types";

interface EmailRowProps {
  categories?: Category[];
  email: Email;
  language: Language;
  todo?: Todo;
  onOpen: (email: Email) => void;
}

export function EmailRow({ categories = [], email, language, todo, onOpen }: EmailRowProps) {
  const todoPrefix = language === "zh" ? "待办：" : "Todo: ";
  const primaryCategory = categories[0];
  const unread = isUnreadEmail(email);

  return (
    <button className={`email-row ${unread ? "email-row-unread" : ""}`} onClick={() => onOpen(email)} type="button">
      <div className="sender-avatar" style={{ "--avatar": primaryCategory?.color || "#52b7ff" } as CSSProperties}>
        {email.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className="email-row-main">
        <div className="email-row-top">
          <span className="sender-name">{email.senderName}</span>
          <span className="email-date">{email.dateLabel}</span>
        </div>
        <div className="email-subject">{email.subject}</div>
        <div className="email-snippet">{todo ? `${todoPrefix}${todo.title}` : email.snippet}</div>
        <div className="email-tags">
          {categories.slice(0, 3).map((category) => (
            <span className="mini-tag" key={category.id} style={{ color: category.color }}>{categoryLabel(category, language)}</span>
          ))}
          {todo ? <span className="mini-tag todo-tag">{language === "zh" ? "已生成待办" : "Todo created"}</span> : null}
          {email.matchedRuleId ? <span className="mini-tag">{language === "zh" ? "规则匹配" : "Rule"}</span> : null}
        </div>
      </div>
      <ChevronRight className="email-chevron" size={18} />
      {unread ? <span aria-label={language === "zh" ? "未读邮件" : "Unread email"} className="unread-dot" /> : null}
    </button>
  );
}
