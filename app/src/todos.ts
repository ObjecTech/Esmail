import type { Email, Todo } from "./types";

export function todoIdForEmail(emailId: string) {
  return `todo-${emailId}`;
}

export function createInitialTodos(emails: Email[]): Todo[] {
  return emails
    .filter((email) => email.aiAction?.mode === "automatic")
    .map((email) => ({
      id: todoIdForEmail(email.id),
      emailId: email.id,
      title: email.aiAction?.title || "",
      source: email.senderName,
      status: "active",
      createdMode: "automatic",
      createdAtLabel: email.dateLabel
    }));
}

export function createSuggestedTodo(email: Email): Todo | null {
  if (!email.aiAction || email.aiAction.mode !== "suggested") return null;
  return createTodoFromEmail(email, email.aiAction.title, "suggested");
}

export function createTodoFromEmail(email: Email, title = email.aiAction?.title || `处理：${email.subject}`, mode: "automatic" | "suggested" = "suggested"): Todo {
  return {
    id: todoIdForEmail(email.id),
    emailId: email.id,
    title,
    source: email.senderName,
    status: "active",
    createdMode: mode,
    createdAtLabel: "刚刚"
  };
}

export function completeTodo(todos: Todo[], todoId: string) {
  return todos.map((todo) => (todo.id === todoId ? { ...todo, status: "completed" as const } : todo));
}

export function activeTodos(todos: Todo[]) {
  return todos.filter((todo) => todo.status === "active");
}
