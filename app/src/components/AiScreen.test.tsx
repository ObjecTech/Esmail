import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Email } from "../types";
import { AiScreen } from "./AiScreen";

const courseworkEmail: Email = {
  id: "coursework",
  senderName: "LM Core",
  senderEmail: "no-reply@lmcore.edu",
  subject: "Coursework 1 submission receipt",
  snippet: "You have submitted your assignment submission for Coursework 1.",
  body: "Do not reply to this email. You have submitted your assignment submission for Coursework 1.",
  dateLabel: "今天",
  fallbackCategoryId: "course",
  fallbackCategoryIds: ["course", "deadline"],
  priority: "high",
  summaryBullets: ["Coursework 1 已提交。"]
};

const examEmail: Email = {
  id: "exam",
  senderName: "Chaoqun Wang",
  senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
  subject: "DTS206TC-2526-S2: Final Exam Schedule",
  snippet: "Final Exam Schedule and room arrangement for DTS206TC.",
  body: "The final exam will take place on 11 June 2026, from 2:00 PM to 4:00 PM. Please check the attached timetable and exam room arrangement.",
  dateLabel: "4/30",
  fallbackCategoryId: "course",
  fallbackCategoryIds: ["course", "deadline"],
  priority: "high",
  summaryBullets: ["考试时间和地点安排在 Final Exam Schedule 邮件中。"]
};

const museumEmail: Email = {
  id: "museum",
  senderName: "museum",
  senderEmail: "events@xjtlu.edu.cn",
  subject: "西浦二十周年AI纹样征集活动开启！ The AI Patte",
  snippet: "Celebrating its 20th anniversary, XJTLU launched a pattern collection event.",
  body: "Dear all, 时光荏苒，弦歌不辍，西交利物浦大学迎来建校二十周年校庆。",
  dateLabel: "4/30",
  fallbackCategoryId: "others",
  fallbackCategoryIds: ["others"],
  priority: "high",
  summaryBullets: ["校庆活动通知。"]
};

const aiSearchPlaceholder = "搜索或询问邮件内容...";

describe("AiScreen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts a fresh conversation when the new AI task button is clicked", async () => {
    const askAssistant = vi.fn().mockResolvedValue({
      title: "已有对话",
      lines: ["旧回答内容"]
    });

    render(
      <AiScreen
        language="zh"
        onAskAssistant={askAssistant}
      />
    );

    const input = screen.getByPlaceholderText(aiSearchPlaceholder);
    fireEvent.change(input, { target: { value: "继续刚才的问题" } });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("旧回答内容")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("新增 AI 任务"));

    await waitFor(() => {
      expect(screen.queryByText("旧回答内容")).toBeNull();
    });
    expect(screen.queryByText("继续刚才的问题")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText("收件箱积压太多？我可以帮忙。")).toBeTruthy();
  });

  it("appends user and assistant messages to the chat", async () => {
    const askAssistant = vi.fn().mockResolvedValue({
      title: "今天需要回复的邮件",
      lines: ["回复导师邮件。"]
    });

    render(<AiScreen language="zh" onAskAssistant={askAssistant} />);

    const input = screen.getByPlaceholderText(aiSearchPlaceholder);
    fireEvent.change(input, { target: { value: "今天需要回复的邮件" } });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("今天需要回复的邮件")).toBeTruthy();
    expect(await screen.findByText("回复导师邮件。")).toBeTruthy();
    expect(screen.getAllByText("今天需要回复的邮件").some((node) => node.closest(".ai-message-user"))).toBe(true);
    expect(screen.getByText("回复导师邮件。").closest(".ai-message-assistant")).toBeTruthy();
  });

  it("saves submitted conversations and restores them from history", async () => {
    const askAssistant = vi.fn().mockResolvedValue({
      title: "今天需要回复的邮件",
      lines: ["回复导师邮件。"]
    });

    render(<AiScreen language="zh" onAskAssistant={askAssistant} />);

    const input = screen.getByPlaceholderText(aiSearchPlaceholder);
    fireEvent.change(input, { target: { value: "今天需要回复的邮件" } });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("回复导师邮件。")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("历史"));

    expect(screen.getByText("今天需要回复的邮件")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "历史对话" })).toBeTruthy();
    expect(screen.queryByPlaceholderText(aiSearchPlaceholder)).toBeNull();

    fireEvent.click(screen.getByText("今天需要回复的邮件"));

    expect(screen.getAllByText("今天需要回复的邮件").some((node) => node.closest(".ai-message-user"))).toBe(true);
    expect(screen.getByText("回复导师邮件。")).toBeTruthy();
    expect(screen.queryByText("暂无历史对话")).toBeNull();
    expect(JSON.parse(localStorage.getItem("esmail.ai.history.v2") || "[]")).toHaveLength(1);
  });

  it("deletes conversations from history without opening them", async () => {
    const askAssistant = vi.fn().mockResolvedValue({
      title: "今天需要回复的邮件",
      lines: ["回复导师邮件。"]
    });

    render(<AiScreen language="zh" onAskAssistant={askAssistant} />);

    const input = screen.getByPlaceholderText(aiSearchPlaceholder);
    fireEvent.change(input, { target: { value: "今天需要回复的邮件" } });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("回复导师邮件。")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("历史"));
    fireEvent.click(screen.getByLabelText("删除历史对话：今天需要回复的邮件"));

    expect(screen.queryByText("今天需要回复的邮件")).toBeNull();
    expect(screen.getByText("暂无历史对话")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("esmail.ai.history.v1") || "[]")).toHaveLength(0);
  });

  it("keeps the send icon visible", () => {
    render(<AiScreen language="zh" onAskAssistant={vi.fn().mockReturnValue(new Promise(() => {}))} />);

    expect(screen.getByLabelText("发送").querySelector("svg")).toBeTruthy();
  });

  it("does not show the voice input button", () => {
    render(<AiScreen language="zh" onAskAssistant={vi.fn().mockReturnValue(new Promise(() => {}))} />);

    expect(screen.queryByLabelText("语音输入")).toBeNull();
  });

  it("renders cited email cards and opens the selected email", async () => {
    const openEmail = vi.fn();

    render(
      <AiScreen
        emails={[courseworkEmail]}
        language="zh"
        onAskAssistant={vi.fn().mockResolvedValue({
          title: "找到了相关邮件",
          lines: ["最相关的是 LM Core 的 Coursework 1 提交通知。"]
        })}
        onOpenEmail={openEmail}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(aiSearchPlaceholder), {
      target: { value: "我之前看到一封 coursework 的邮件，帮我找一下" }
    });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("Coursework 1 submission receipt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开邮件" }));

    expect(openEmail).toHaveBeenCalledWith(courseworkEmail);
  });

  it("hides cited email excerpts until the summary is expanded", async () => {
    render(
      <AiScreen
        emails={[courseworkEmail]}
        language="zh"
        onAskAssistant={vi.fn().mockResolvedValue({
          title: "找到了相关邮件",
          lines: ["最相关的是 LM Core 的 Coursework 1 提交通知。"]
        })}
        onOpenEmail={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(aiSearchPlaceholder), {
      target: { value: "coursework 邮件" }
    });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("Coursework 1 submission receipt")).toBeTruthy();
    expect(screen.queryByText(/You have submitted/)).toBeNull();
    expect(screen.queryByText("Coursework 1 已提交。")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开总结" }));

    expect(screen.getAllByText("LM Core · 今天").length).toBeGreaterThan(1);
    expect(screen.getByText("Coursework 1 已提交。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "展开总结" })).toBeNull();
    expect(screen.getByRole("button", { name: "收起总结" })).toBeTruthy();
  });

  it("uses the latest email summary when expanding an existing citation", async () => {
    const staleEmail = {
      ...examEmail,
      summaryBullets: ["DTS206TC-2526-S2: Final Exam Schedule"]
    };
    const updatedEmail = {
      ...examEmail,
      summaryBullets: [
        "The final exam for DTS206TC is scheduled for 11 June 2026.",
        "The exam will take place from 2:00 PM to 4:00 PM."
      ],
      summaryGenerated: true as const,
      summaryLanguage: "en" as const
    };
    const askAssistant = vi.fn().mockResolvedValue({
      title: "DTS206TC Final Exam Schedule",
      lines: ["Date and time are in the exam schedule email."]
    });
    const { rerender } = render(
      <AiScreen
        emails={[staleEmail]}
        language="en"
        onAskAssistant={askAssistant}
        onOpenEmail={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search or ask about mail..."), {
      target: { value: "DTS206 final exam schedule" }
    });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(await screen.findByText("DTS206TC-2526-S2: Final Exam Schedule")).toBeTruthy();

    rerender(
      <AiScreen
        emails={[updatedEmail]}
        language="en"
        onAskAssistant={askAssistant}
        onOpenEmail={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand summary" }));

    expect(screen.getByText("The final exam for DTS206TC is scheduled for 11 June 2026.")).toBeTruthy();
    expect(screen.getByText("The exam will take place from 2:00 PM to 4:00 PM.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse summary" })).toBeTruthy();
    expect(screen.queryAllByText("DTS206TC-2526-S2: Final Exam Schedule")).toHaveLength(1);
  });

  it("replaces paste-email assistant headers when matching citations exist", async () => {
    render(
      <AiScreen
        emails={[examEmail]}
        language="en"
        onAskAssistant={vi.fn().mockResolvedValue({
          title: "Please paste the email text for **DTS206 Week 11**",
          lines: ["Once you provide the content, I will summarize the key tasks."]
        })}
        onOpenEmail={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search or ask about mail..."), {
      target: { value: "DTS206 final exam schedule" }
    });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(await screen.findByText("Found related emails")).toBeTruthy();
    expect(screen.queryByText(/Please paste the email text/)).toBeNull();
    expect(screen.getByText("DTS206TC-2526-S2: Final Exam Schedule")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand summary" })).toBeTruthy();
    expect(screen.queryByText("考试时间和地点安排在 Final Exam Schedule 邮件中。")).toBeNull();
  });

  it("shows a placeholder for searching more mail when local matches are limited", async () => {
    render(
      <AiScreen
        emails={[]}
        language="zh"
        onAskAssistant={vi.fn().mockResolvedValue({
          title: "我先查了当前邮件",
          lines: ["当前已同步邮件里没有足够匹配结果。"]
        })}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(aiSearchPlaceholder), {
      target: { value: "帮我找一下之前看到的 Agoda 酒店优惠邮件" }
    });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findByText("继续搜索更多邮件")).toBeTruthy();
  });

  it("cites the email identified by the assistant answer for cross-language exam questions", async () => {
    render(
      <AiScreen
        emails={[museumEmail, courseworkEmail, examEmail]}
        language="zh"
        onAskAssistant={vi.fn().mockResolvedValue({
          title: "DTS206TC-2526-S2: Final Exam Schedule",
          lines: [
            "发件人：Chaoqun Wang（Chaoqun.Wang@xjtlu.edu.cn）",
            "内容/位置：邮件主题为 Final Exam Schedule，说明考试安排已通过该邮件发送。"
          ]
        })}
        onOpenEmail={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(aiSearchPlaceholder), {
      target: { value: "王超群老师对于考试的安排在哪里" }
    });
    fireEvent.click(screen.getByLabelText("发送"));

    expect(await screen.findAllByText("DTS206TC-2526-S2: Final Exam Schedule")).toHaveLength(2);
    expect(screen.queryByText("西浦二十周年AI纹样征集活动开启！ The AI Patte")).toBeNull();
    expect(screen.queryByText("You have submitted your assignment submission for Coursework 1")).toBeNull();
  });
});
