import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
const mockData = vi.hoisted(() => ({
  messages: [
    {
      id: "mail-1",
      senderName: "Tutor",
      senderEmail: "tutor@example.edu",
      subject: "Unread One",
      snippet: "First unread mail",
      body: "First unread mail",
      dateLabel: "今天",
      fallbackCategoryId: "course",
      fallbackCategoryIds: ["course"],
      priority: "medium",
      summaryBullets: ["First unread mail"],
      unread: true,
      fullLoaded: true
    },
    {
      id: "mail-2",
      senderName: "Admin",
      senderEmail: "admin@example.edu",
      subject: "Unread Two",
      snippet: "Second unread mail",
      body: "Second unread mail",
      dateLabel: "今天",
      fallbackCategoryId: "others",
      fallbackCategoryIds: ["others"],
      priority: "medium",
      summaryBullets: ["Second unread mail"],
      unread: true,
      fullLoaded: true
    }
  ],
  updateGmailMessage: vi.fn().mockResolvedValue({ ok: true })
}));

vi.mock("./api", () => ({
  analyzeInbox: vi.fn().mockResolvedValue([]),
  askAssistant: vi.fn(),
  createDraft: vi.fn(),
  getEmailMessage: vi.fn(),
  getGmailMessages: vi.fn().mockResolvedValue(mockData.messages),
  getSession: vi.fn().mockResolvedValue({
    authenticated: true,
    provider: "google",
    email: "me@example.com"
  }),
  loginQqMailbox: vi.fn(),
  logoutGoogle: vi.fn(),
  sendEmail: vi.fn(),
  updateGmailMessage: mockData.updateGmailMessage
}));

describe("App unread state", () => {
  it("marks an opened unread email as read and lowers the inbox unread badge", async () => {
    render(<App />);

    await screen.findByText("Unread One");
    expect(document.querySelector(".nav-badge")?.textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: /Unread One/ }));
    await screen.findByText("完整正文");

    expect(mockData.updateGmailMessage).toHaveBeenCalledWith("mail-1", "markRead");

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    await waitFor(() => {
      expect(document.querySelector(".nav-badge")?.textContent).toBe("1");
    });
  });

  it("switches from the classic theme directly to white", async () => {
    window.localStorage.setItem("esmail.theme", "classic");
    render(<App />);

    await screen.findByText("Unread One");
    fireEvent.click(screen.getByRole("button", { name: "菜单" }));
    fireEvent.click(await screen.findByRole("button", { name: /主题/ }));

    expect(document.querySelector(".phone-stage")?.getAttribute("data-theme")).toBe("white");
  });
});
