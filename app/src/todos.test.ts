import { describe, expect, it } from "vitest";
import { completeTodo, createInitialTodos } from "./todos";
import type { Email } from "./types";

const emails: Email[] = [
  {
    id: "mail-1",
    senderName: "OpenAI",
    senderEmail: "karen@openai.com",
    subject: "Join workspace",
    snippet: "Accept the invitation.",
    body: "Accept the invitation.",
    dateLabel: "昨天",
    fallbackCategoryId: "important",
    categoryId: "important",
    priority: "high",
    summaryBullets: ["邀请加入 OAI 工作空间。"],
    aiAction: {
      mode: "automatic",
      title: "接受加入 OAI 工作空间的邀请"
    }
  }
];

describe("todo helpers", () => {
  it("creates active todos from automatic AI actions", () => {
    const todos = createInitialTodos(emails);

    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("接受加入 OAI 工作空间的邀请");
    expect(todos[0].status).toBe("active");
  });

  it("completes a todo by id", () => {
    const [todo] = createInitialTodos(emails);
    const completed = completeTodo([todo], todo.id);

    expect(completed[0].status).toBe("completed");
  });
});
