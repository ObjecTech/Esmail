import { Check, ChevronRight } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";
import { useRef } from "react";
import { categoryLabel } from "../language";
import { isUnreadEmail } from "../mailState";
import type { Category, Email, Language, Todo } from "../types";

interface EmailRowProps {
  categories?: Category[];
  email: Email;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  language: Language;
  todo?: Todo;
  onOpen: (email: Email) => void;
  onLongPress?: (email: Email) => void;
  onSelectionToggle?: (email: Email) => void;
}

function normalizedPreviewText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function EmailRow({
  categories = [],
  email,
  isSelected = false,
  isSelectionMode = false,
  language,
  todo,
  onOpen,
  onLongPress,
  onSelectionToggle
}: EmailRowProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const todoPrefix = language === "zh" ? "待办：" : "Todo: ";
  const primaryCategory = categories[0];
  const unread = isUnreadEmail(email);
  const snippet = email.snippet.trim();
  const shouldShowSnippet = Boolean(snippet) && normalizedPreviewText(snippet) !== normalizedPreviewText(email.subject);

  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (isSelectionMode || event.button > 0) return;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.(email);
    }, 450);
  }

  function handlePointerEnd() {
    clearLongPressTimer();
  }

  function handleClick() {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isSelectionMode) {
      onSelectionToggle?.(email);
      return;
    }
    onOpen(email);
  }

  return (
    <button
      aria-pressed={isSelectionMode ? isSelected : undefined}
      className={`email-row ${unread ? "email-row-unread" : ""} ${isSelectionMode ? "email-row-selecting" : ""} ${isSelected ? "email-row-selected" : ""}`}
      onClick={handleClick}
      onContextMenu={(event) => {
        if (!isSelectionMode) event.preventDefault();
      }}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerEnd}
      onPointerUp={handlePointerEnd}
      type="button"
    >
      <div
        aria-label={isSelectionMode && isSelected ? (language === "zh" ? "已选择邮件" : "Selected email") : undefined}
        className={`sender-avatar ${isSelectionMode ? "selection-avatar" : ""} ${isSelected ? "selection-avatar-active" : ""}`}
        style={{ "--avatar": primaryCategory?.color || "#52b7ff" } as CSSProperties}
      >
        {isSelectionMode && isSelected ? <Check size={23} strokeWidth={3} /> : email.senderName.slice(0, 1).toUpperCase()}
      </div>
      <div className="email-row-main">
        <div className="email-row-top">
          <span className="sender-name">{email.senderName}</span>
          <span className="email-date">{email.dateLabel}</span>
        </div>
        <div className="email-subject">{email.subject}</div>
        {todo ? <div className="email-snippet">{todoPrefix}{todo.title}</div> : shouldShowSnippet ? <div className="email-snippet">{snippet}</div> : null}
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
