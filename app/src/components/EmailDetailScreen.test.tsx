import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Email, Todo } from "../types";
import { EmailDetailScreen } from "./EmailDetailScreen";

const email: Email = {
  id: "mail-1",
  senderName: "Chaoqun Wang",
  senderEmail: "teacher@example.edu",
  subject: "Final Exam Schedule",
  snippet: "Exam time is 11 June 2026.",
  body: "The final exam will take place on 11 June 2026, from 2:00 PM to 4:00 PM.",
  dateLabel: "4/30",
  fallbackCategoryId: "deadline",
  priority: "high",
  summaryBullets: ["考试时间为 2026 年 6 月 11 日 14:00-16:00。"],
  fullLoaded: true
};

const todo: Todo = {
  id: "todo-mail-1",
  emailId: "mail-1",
  title: "查看邮件获取考试时间和地点",
  source: "Chaoqun Wang",
  status: "active",
  createdMode: "automatic",
  createdAtLabel: "4/30"
};

describe("EmailDetailScreen", () => {
  it("shows summary and todo above the full message body", () => {
    render(
      <EmailDetailScreen
        email={email}
        isTodoCompleted={false}
        language="zh"
        notice=""
        onAction={vi.fn()}
        onAddSuggestedTodo={vi.fn()}
        onBack={vi.fn()}
        onCompleteTodo={vi.fn()}
        todo={todo}
      />
    );

    const summary = screen.getByText("总结").closest("article");
    const todoCard = screen.getByText("查看邮件获取考试时间和地点").closest(".detail-todo-card");
    const body = screen.getByText("完整正文").closest("article");

    expect(summary).toBeTruthy();
    expect(todoCard).toBeTruthy();
    expect(body).toBeTruthy();
    expect(summary?.compareDocumentPosition(todoCard as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(todoCard?.compareDocumentPosition(body as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
