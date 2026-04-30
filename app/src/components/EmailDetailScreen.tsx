import { Archive, BadgeMinus, ChevronLeft, Clock3, Filter, MailOpen, MoreHorizontal, Printer, Reply, Star, Trash2, ThumbsDown, ThumbsUp, Timer } from "lucide-react";
import { useState } from "react";
import type { Email, Language, Todo } from "../types";
import { IconButton } from "./IconButton";
import { TodoCheck } from "./TodoCheck";

interface EmailDetailScreenProps {
  email: Email;
  todo?: Todo;
  isTodoCompleted: boolean;
  language: Language;
  notice: string;
  onAddSuggestedTodo: (email: Email) => void;
  onAction: (email: Email, action: "toggleStar" | "archive" | "delete" | "markUnread" | "markNotImportant" | "snooze" | "createTodo" | "filterSender" | "print") => void | Promise<void>;
  onBack: () => void;
  onCompleteTodo: (todoId: string) => void;
}

export function EmailDetailScreen({
  email,
  todo,
  isTodoCompleted,
  language,
  notice,
  onAddSuggestedTodo,
  onAction,
  onBack,
  onCompleteTodo
}: EmailDetailScreenProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const summary = email.summaryBullets.slice(0, 3);
  const isZh = language === "zh";

  function runAction(action: Parameters<EmailDetailScreenProps["onAction"]>[1]) {
    setMoreOpen(false);
    void onAction(email, action);
  }

  const moreItems = [
    { action: "markNotImportant" as const, label: isZh ? "标记为不重要" : "Mark not important", icon: BadgeMinus },
    { action: "markUnread" as const, label: isZh ? "设为未读" : "Mark unread", icon: MailOpen },
    { action: "snooze" as const, label: isZh ? "延后" : "Snooze", icon: Timer },
    { action: "delete" as const, label: isZh ? "垃圾邮件" : "Move to trash", icon: Trash2 },
    { action: "createTodo" as const, label: isZh ? "创建待办" : "Create todo", icon: Clock3 },
    { action: "filterSender" as const, label: isZh ? "过滤此类邮件" : "Filter this sender", icon: Filter },
    { action: "print" as const, label: isZh ? "打印全部" : "Print all", icon: Printer }
  ];

  return (
    <section className="screen-section detail-screen">
      <header className="detail-toolbar">
        <IconButton label="返回" onClick={onBack}>
          <ChevronLeft size={30} />
        </IconButton>
        <div className="detail-actions">
          <IconButton active={email.starred} label={isZh ? "收藏" : "Star"} onClick={() => runAction("toggleStar")}>
            <Star fill={email.starred ? "currentColor" : "none"} size={24} />
          </IconButton>
          <IconButton label={isZh ? "归档" : "Archive"} onClick={() => runAction("archive")}>
            <Archive size={23} />
          </IconButton>
          <IconButton label={isZh ? "删除" : "Delete"} onClick={() => runAction("delete")}>
            <Trash2 size={23} />
          </IconButton>
        </div>
        <IconButton active={moreOpen} label={isZh ? "更多" : "More"} onClick={() => setMoreOpen((open) => !open)}>
          <MoreHorizontal size={27} />
        </IconButton>
      </header>

      {moreOpen ? (
        <div className="detail-more-menu">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.action} onClick={() => runAction(item.action)} type="button">
                <Icon size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <h1 className="detail-title">{email.subject}</h1>
      <div className="sender-line">
        <div className="sender-avatar large-avatar">{email.senderName.slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="detail-sender">{email.senderName}</div>
          <div className="detail-meta">{email.dateLabel} · {isZh ? "发送给：我" : "To: me"}</div>
        </div>
        <Reply className="reply-icon" size={25} />
        <button className="inline-more-button" onClick={() => setMoreOpen((open) => !open)} type="button" aria-label={isZh ? "更多操作" : "More actions"}>
          <MoreHorizontal size={26} />
        </button>
      </div>

      <div className="blocked-line">{isZh ? "已拦截 1 个追踪器" : "1 tracker blocked"}</div>
      {notice ? <div className="detail-notice">{notice}</div> : null}

      <article className="summary-card">
        <div className="summary-card-head">
          <h2>{isZh ? "总结" : "Summary"}</h2>
          <div className="summary-feedback">
            <button onClick={() => runAction("createTodo")} type="button" aria-label={isZh ? "创建待办" : "Create todo"}>
              <ThumbsUp size={21} />
            </button>
            <button onClick={() => runAction("markNotImportant")} type="button" aria-label={isZh ? "标记不重要" : "Mark not important"}>
              <ThumbsDown size={21} />
            </button>
          </div>
        </div>
        <ul>
          {summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      {todo ? (
        <div className={`detail-todo-card ${todo.status === "completed" ? "detail-todo-card-complete" : ""}`}>
          <TodoCheck
            checked={todo.status === "completed"}
            label={todo.title}
            onToggle={() => onCompleteTodo(todo.id)}
          />
          <div>
            <div className="detail-todo-title">{todo.title}</div>
            <div className="detail-todo-meta">{todo.status === "completed" ? (isZh ? "已完成" : "Done") : (isZh ? "AI 自动创建" : "Created by AI")} · {todo.createdAtLabel}</div>
          </div>
        </div>
      ) : email.aiAction?.mode === "suggested" && !isTodoCompleted ? (
        <button className="suggested-todo-card" onClick={() => onAddSuggestedTodo(email)} type="button">
          <span className="suggested-plus">+</span>
          <span>{isZh ? "加入待办" : "Add todo"}：{email.aiAction.title}</span>
        </button>
      ) : null}

      <div className="email-body">
        <p>{email.body}</p>
      </div>
    </section>
  );
}
