import { Check, CheckCircle2, Circle, Menu, X } from "lucide-react";
import { text } from "../language";
import { useState } from "react";
import type { Email, Language, Todo } from "../types";
import { IconButton } from "./IconButton";
import { TodoCheck } from "./TodoCheck";

interface TodosScreenProps {
  editMode: boolean;
  emails: Email[];
  language: Language;
  todos: Todo[];
  onCompleteAll: () => void;
  onCompleteTodo: (todoId: string) => void;
  onDeleteTodos: (todoIds: string[]) => void;
  onCompleteTodos: (todoIds: string[]) => void;
  onEditModeChange: (editing: boolean) => void;
  onOpenEmail: (email: Email) => void;
}

export function TodosScreen({
  editMode,
  emails,
  language,
  todos,
  onCompleteAll,
  onCompleteTodo,
  onCompleteTodos,
  onDeleteTodos,
  onEditModeChange,
  onOpenEmail
}: TodosScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const activeTodos = todos.filter((todo) => todo.status === "active");
  const completedTodos = todos.filter((todo) => todo.status === "completed");
  const visibleTodos = showCompleted ? completedTodos : activeTodos;
  const allVisibleSelected = visibleTodos.length > 0 && visibleTodos.every((todo) => selectedTodoIds.includes(todo.id));

  function toggleSelected(todoId: string) {
    setSelectedTodoIds((current) => current.includes(todoId) ? current.filter((id) => id !== todoId) : [...current, todoId]);
  }

  function selectAllVisible() {
    setSelectedTodoIds(allVisibleSelected ? [] : visibleTodos.map((todo) => todo.id));
  }

  function finishEditing() {
    setSelectedTodoIds([]);
    onEditModeChange(false);
  }

  return (
    <section className="screen-section todos-screen">
      <header className="center-title-header">
        {editMode ? (
          <button className="edit-confirm-button" onClick={finishEditing} type="button" aria-label={language === "zh" ? "完成编辑" : "Finish editing"}>
            <Check size={31} strokeWidth={3} />
          </button>
        ) : (
          <button className="text-pill" onClick={() => onEditModeChange(true)} type="button">
            {text(language, "edit")}
          </button>
        )}
        <div>
          <h1>{language === "zh" ? (showCompleted ? `${completedTodos.length} 已完成` : "待办") : (showCompleted ? `${completedTodos.length} Done` : "Todos")}</h1>
          <p>{language === "zh" ? "刚刚更新" : "Updated now"}</p>
        </div>
        {showCompleted ? (
          <IconButton label={language === "zh" ? "关闭完成项" : "Close completed"} onClick={() => setShowCompleted(false)}>
            <X size={28} />
          </IconButton>
        ) : (
        <IconButton label={language === "zh" ? "待办菜单" : "Todo menu"} onClick={() => setMenuOpen((open) => !open)}>
          <Menu size={28} />
        </IconButton>
        )}
      </header>

      {menuOpen ? (
        <div className="todo-menu-popover">
          <button
            className="todo-menu-row lead"
            onClick={() => {
              setShowCompleted(true);
              setMenuOpen(false);
            }}
            type="button"
          >
            <CheckCircle2 size={25} />
            <span>{text(language, "completed")}</span>
          </button>
        </div>
      ) : null}

      {visibleTodos.length === 0 ? (
        <div className="done-empty">
          <div className="done-illustration">🙏</div>
          <h2>{language === "zh" ? "任务已处理完毕！" : "All caught up!"}</h2>
          <p>{language === "zh" ? "后续的邮件待办事项会自动添加到这里，您无需费心。" : "Future email tasks will appear here automatically."}</p>
        </div>
      ) : (
        <div className="todo-list">
          {visibleTodos.map((todo) => {
            const email = emails.find((item) => item.id === todo.emailId);
            return (
              <div className={`todo-item ${todo.status === "completed" ? "todo-item-completed" : ""}`} key={todo.id}>
                {editMode ? (
                  <button
                    className={`edit-select-button ${selectedTodoIds.includes(todo.id) ? "edit-select-button-active" : ""}`}
                    onClick={() => toggleSelected(todo.id)}
                    type="button"
                    aria-label={language === "zh" ? "选择待办" : "Select todo"}
                  >
                    {selectedTodoIds.includes(todo.id) ? <Check size={18} /> : <Circle size={25} />}
                  </button>
                ) : (
                  <TodoCheck checked={todo.status === "completed"} label={todo.title} onToggle={() => onCompleteTodo(todo.id)} />
                )}
                <button
                  className="todo-item-main"
                  disabled={!email}
                  onClick={() => email && onOpenEmail(email)}
                  type="button"
                >
                  <span>{todo.title}</span>
                  <small>{todo.source} · {todo.createdAtLabel}</small>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {editMode ? (
        <div className="todo-edit-bar">
          <button onClick={selectAllVisible} type="button">{allVisibleSelected ? (language === "zh" ? "取消全选" : "Clear") : text(language, "allSelect")}</button>
          <button
            onClick={() => {
              const ids = selectedTodoIds.length ? selectedTodoIds : visibleTodos.map((todo) => todo.id);
              onCompleteTodos(ids);
              setSelectedTodoIds([]);
            }}
            type="button"
          >
            {text(language, "markDone")}
          </button>
          <button
            className="danger-action"
            onClick={() => {
              const ids = selectedTodoIds.length ? selectedTodoIds : visibleTodos.map((todo) => todo.id);
              onDeleteTodos(ids);
              setSelectedTodoIds([]);
            }}
            type="button"
          >
            {text(language, "delete")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
