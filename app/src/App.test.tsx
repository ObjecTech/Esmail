import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
const mockData = vi.hoisted(() => {
  const baseMessages = [
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
  ];

  return {
    baseMessages,
    messages: baseMessages,
    analyzeInbox: vi.fn(),
    askAssistant: vi.fn(),
    getEmailMessage: vi.fn(),
    getGmailMessages: vi.fn(),
    updateGmailMessage: vi.fn()
  };
});

vi.mock("./api", () => ({
  analyzeInbox: mockData.analyzeInbox,
  askAssistant: mockData.askAssistant,
  createDraft: vi.fn(),
  getEmailMessage: mockData.getEmailMessage,
  getGmailMessages: mockData.getGmailMessages,
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
  beforeEach(() => {
    window.localStorage.clear();
    mockData.messages = mockData.baseMessages.map((email) => ({
      ...email,
      fallbackCategoryIds: [...email.fallbackCategoryIds],
      summaryBullets: [...email.summaryBullets]
    }));
    mockData.analyzeInbox.mockReset();
    mockData.analyzeInbox.mockResolvedValue([]);
    mockData.askAssistant.mockReset();
    mockData.askAssistant.mockResolvedValue({ title: "AI reply", lines: ["Done"] });
    mockData.getEmailMessage.mockReset();
    mockData.getEmailMessage.mockResolvedValue(mockData.messages[0]);
    mockData.getGmailMessages.mockReset();
    mockData.getGmailMessages.mockResolvedValue(mockData.messages);
    mockData.updateGmailMessage.mockReset();
    mockData.updateGmailMessage.mockResolvedValue({ ok: true });
  });

  it("marks an opened unread email as read and lowers the inbox unread badge", async () => {
    render(<App />);

    await screen.findByText("Unread One");
    expect(screen.getByPlaceholderText("Search")).toBeTruthy();
    expect(document.querySelector(".nav-badge")?.textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: /Unread One/ }));
    await screen.findByText("Full message");

    expect(mockData.updateGmailMessage).toHaveBeenCalledWith("mail-1", "markRead");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(document.querySelector(".nav-badge")?.textContent).toBe("1");
    });
  });

  it.each(["classic", "eye"])("ignores the removed %s theme and renders Morandi", async (storedTheme) => {
    window.localStorage.setItem("esmail.theme", storedTheme);
    render(<App />);

    await screen.findByText("Unread One");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(document.querySelector(".phone-stage")?.getAttribute("data-theme")).toBe("morandi");
    expect(await screen.findByRole("button", { name: /Theme/ })).toBeTruthy();
  });

  it("switches between Morandi and the restored white theme", async () => {
    window.localStorage.setItem("esmail.theme", "morandi");
    render(<App />);

    await screen.findByText("Unread One");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(await screen.findByRole("button", { name: /Theme/ }));

    expect(document.querySelector(".phone-stage")?.getAttribute("data-theme")).toBe("white");

    fireEvent.click(await screen.findByRole("button", { name: /Theme/ }));

    expect(document.querySelector(".phone-stage")?.getAttribute("data-theme")).toBe("morandi");
  });

  it("generates a summary from a preloaded body when opening the detail", async () => {
    mockData.messages[0] = {
      ...mockData.messages[0],
      summaryBullets: ["Raw inbox snippet"],
      fullLoaded: false
    };
    mockData.getGmailMessages.mockResolvedValue(mockData.messages);
    mockData.analyzeInbox.mockResolvedValue([
      {
        id: "mail-1",
        summaryBullets: ["AI 总结：需要查看课程反馈。"],
        categoryId: "course",
        categoryIds: ["course"]
      }
    ]);
    mockData.getEmailMessage.mockResolvedValue({
      ...mockData.messages[0],
      body: "Dear all, The main context could be found as follows: please read the whole forwarded message.",
      summaryBullets: ["Dear all, The main context could be found as follows: please read the whole forwarded message."]
    });

    render(<App />);

    await screen.findByText("Unread One");
    expect(mockData.analyzeInbox).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Unread One/ }));

    expect(await screen.findByText("AI 总结：需要查看课程反馈。")).toBeTruthy();
    expect(mockData.analyzeInbox).toHaveBeenCalledTimes(1);
    expect(mockData.analyzeInbox.mock.calls[0][0][0].body).toContain("Dear all");

    await waitFor(() => {
      const summary = screen.getByText("Summary").closest("article");
      expect(within(summary as HTMLElement).queryByText(/^Dear all, The main context/)).toBeNull();
    });
  });

  it("does not summarize initial mailbox details until the preloaded detail is opened", async () => {
    mockData.messages[0] = {
      ...mockData.messages[0],
      subject: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
      snippet: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
      body: "",
      summaryBullets: ["DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED"],
      fullLoaded: false
    };
    mockData.getGmailMessages.mockResolvedValue(mockData.messages);
    mockData.analyzeInbox.mockResolvedValue([
      {
        id: "mail-1",
        summaryBullets: [
          "DTS202TC 的 marking review 已完成，请进入课程公告查看结果。",
          "评阅结果已经更新。",
          "如对成绩有疑问，可以联系学院。"
        ],
        categoryId: "course",
        categoryIds: ["course"]
      }
    ]);
    mockData.getEmailMessage.mockResolvedValue({
      ...mockData.messages[0],
      body: "DTS202TC Marking Review COMPLETED by Angelos Stefanidis. The marking review has been completed. Please check the course announcement for the reviewed marking outcome."
    });

    render(<App />);

    await screen.findAllByText("DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED");
    expect(mockData.getEmailMessage).toHaveBeenCalledWith("mail-1");
    expect(mockData.analyzeInbox).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /DTS202TC-2526-S1/ }));

    expect(await screen.findByText("Generating summary")).toBeTruthy();
    await waitFor(() => expect(mockData.analyzeInbox).toHaveBeenCalledTimes(1));
    expect(mockData.analyzeInbox.mock.calls[0][0][0].body).toContain("The marking review has been completed");
    expect(mockData.analyzeInbox.mock.calls[0][1]).toBe("en");
    const summary = screen.getByText("Summary").closest("article");
    expect(within(summary as HTMLElement).queryByText("DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED")).toBeNull();
    expect(await screen.findByText("DTS202TC 的 marking review 已完成，请进入课程公告查看结果。")).toBeTruthy();
    expect(screen.queryByText("Generating summary")).toBeNull();
  });

  it("preloads full bodies for the first 15 loaded mailbox messages without generating summaries", async () => {
    const messages = Array.from({ length: 16 }, (_, index) => {
      const position = index + 1;
      return {
        ...mockData.baseMessages[0],
        id: `mail-${position}`,
        subject: `Subject ${position}`,
        snippet: `Snippet ${position}`,
        body: "",
        summaryBullets: [`Snippet ${position}`],
        fullLoaded: false
      };
    });
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.getEmailMessage.mockImplementation(async (id: string) => {
      const email = messages.find((item) => item.id === id) || messages[0];
      return {
        ...email,
        body: `Full body for ${id}`,
        summaryBullets: [`Detail ${id}`]
      };
    });
    mockData.analyzeInbox.mockImplementation(async (items: typeof messages) =>
      items.map((email) => ({
        id: email.id,
        summaryBullets: [`Summary from ${email.body || email.snippet}`],
        categoryId: "course",
        categoryIds: ["course"]
      }))
    );

    render(<App />);

    await screen.findByText("Subject 1");
    await waitFor(() => expect(mockData.getEmailMessage).toHaveBeenCalledTimes(15));

    expect(mockData.getEmailMessage.mock.calls.map((call) => call[0])).toEqual(
      Array.from({ length: 15 }, (_, index) => `mail-${index + 1}`)
    );
    expect(mockData.analyzeInbox).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Subject 1").closest("button") as HTMLElement);
    expect(await screen.findByText("Full body for mail-1")).toBeTruthy();
    expect(await screen.findByText("Summary from Full body for mail-1")).toBeTruthy();
    expect(mockData.getEmailMessage).toHaveBeenCalledTimes(15);
    expect(mockData.analyzeInbox).toHaveBeenCalledTimes(1);
    expect(mockData.analyzeInbox.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({ id: "mail-1", body: "Full body for mail-1", fullLoaded: true })
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByText("Subject 16").closest("button") as HTMLElement);

    await waitFor(() => expect(mockData.getEmailMessage).toHaveBeenCalledTimes(16));
    expect(mockData.getEmailMessage.mock.calls[15][0]).toBe("mail-16");
    expect(await screen.findByText("Summary from Full body for mail-16")).toBeTruthy();
    expect(mockData.analyzeInbox).toHaveBeenCalledTimes(2);
  });

  it("keeps a loaded message body and summary cached when the mailbox reloads later", async () => {
    const messages = Array.from({ length: 16 }, (_, index) => {
      const position = index + 1;
      return {
        ...mockData.baseMessages[0],
        id: `mail-${position}`,
        subject: `Cached Subject ${position}`,
        snippet: `Cached Snippet ${position}`,
        body: "",
        summaryBullets: [`Cached Snippet ${position}`],
        fullLoaded: false
      };
    });
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.getEmailMessage.mockImplementation(async (id: string) => {
      const email = messages.find((item) => item.id === id) || messages[0];
      return {
        ...email,
        body: `Cached full body for ${id}`,
        summaryBullets: [`Loaded summary for ${id}`]
      };
    });
    mockData.analyzeInbox.mockImplementation(async (items: typeof messages) =>
      items.map((email) => ({
        id: email.id,
        summaryBullets: [`Cached AI summary from ${email.body || email.snippet}`],
        categoryId: "course",
        categoryIds: ["course"]
      }))
    );

    const { unmount } = render(<App />);

    await screen.findByText("Cached Subject 1");
    await waitFor(() => expect(mockData.getEmailMessage).toHaveBeenCalledTimes(15));
    expect(mockData.analyzeInbox).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Cached Subject 16").closest("button") as HTMLElement);
    await screen.findByText("Cached full body for mail-16");
    await screen.findByText("Cached AI summary from Cached full body for mail-16");
    await waitFor(() => expect(mockData.getEmailMessage).toHaveBeenCalledTimes(16));
    unmount();

    mockData.getEmailMessage.mockClear();
    mockData.analyzeInbox.mockClear();
    render(<App />);

    await screen.findByText("Cached Subject 1");

    fireEvent.click(screen.getByText("Cached Subject 16").closest("button") as HTMLElement);

    expect(await screen.findByText("Cached full body for mail-16")).toBeTruthy();
    expect(screen.getByText("Cached AI summary from Cached full body for mail-16")).toBeTruthy();
    expect(mockData.getEmailMessage).not.toHaveBeenCalledWith("mail-16");
    expect(mockData.analyzeInbox).not.toHaveBeenCalledWith(
      [expect.objectContaining({ id: "mail-16" })],
      "en"
    );
  });

  it("regenerates a cached summary when the cached language does not match the app language", async () => {
    const messages = [
      {
        ...mockData.baseMessages[0],
        id: "mail-language-cache",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "Final exam schedule and room arrangement.",
        body: "",
        summaryBullets: ["Final exam schedule preview."],
        fullLoaded: false
      }
    ];
    window.localStorage.setItem("esmail.emailDetails.v1", JSON.stringify({
      "mail-language-cache": {
        body: "Final exam date is 11 June 2026 from 2 PM to 4 PM.",
        summaryBullets: ["课程 DTS206 的期末考试安排在 2026-06-11 下午2:00-4:00"],
        summaryGenerated: true,
        summaryLanguage: "zh"
      }
    }));
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.analyzeInbox.mockResolvedValue([
      {
        id: "mail-language-cache",
        summaryBullets: ["DTS206 final exam is scheduled for 11 June 2026 from 2 PM to 4 PM."],
        categoryId: "course",
        categoryIds: ["course"]
      }
    ]);

    render(<App />);

    await screen.findByText("DTS206TC-2526-S2: Final Exam Schedule");
    fireEvent.click(screen.getByText("DTS206TC-2526-S2: Final Exam Schedule").closest("button") as HTMLElement);

    expect(await screen.findByText("DTS206 final exam is scheduled for 11 June 2026 from 2 PM to 4 PM.")).toBeTruthy();
    expect(screen.queryByText("课程 DTS206 的期末考试安排在 2026-06-11 下午2:00-4:00")).toBeNull();
    expect(mockData.getEmailMessage).not.toHaveBeenCalledWith("mail-language-cache");
    expect(mockData.analyzeInbox).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "mail-language-cache", body: "Final exam date is 11 June 2026 from 2 PM to 4 PM." })],
      "en"
    );
  });

  it("regenerates older English summary cache entries while keeping the cached body", async () => {
    const messages = [
      {
        ...mockData.baseMessages[0],
        id: "mail-old-summary-cache",
        subject: "Student Activity: Fencing Competition",
        snippet: "Dear all, The main context could be found as follows.",
        body: "",
        summaryBullets: ["Activity preview."],
        fullLoaded: false
      }
    ];
    window.localStorage.setItem("esmail.emailDetails.v1", JSON.stringify({
      "mail-old-summary-cache": {
        body: "Dear all, The main context could be found as follows: Event: Sport Centre 2026 XJTLU Fencing Competition.",
        summaryBullets: ["Dear all, The main context could be found as follows: Event: Sport Centre 1."],
        summaryGenerated: true,
        summaryLanguage: "en"
      }
    }));
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.analyzeInbox.mockResolvedValue([
      {
        id: "mail-old-summary-cache",
        summaryBullets: ["XJTLU is hosting a fencing competition at the Sport Centre."],
        categoryId: "university-notice",
        categoryIds: ["university-notice"]
      }
    ]);

    render(<App />);

    await screen.findByText("Student Activity: Fencing Competition");
    fireEvent.click(screen.getByText("Student Activity: Fencing Competition").closest("button") as HTMLElement);

    expect(await screen.findByText("XJTLU is hosting a fencing competition at the Sport Centre.")).toBeTruthy();
    expect(screen.queryByText("Dear all, The main context could be found as follows: Event: Sport Centre 1.")).toBeNull();
    expect(mockData.getEmailMessage).not.toHaveBeenCalledWith("mail-old-summary-cache");
    expect(mockData.analyzeInbox).toHaveBeenCalledWith(
      [expect.objectContaining({
        id: "mail-old-summary-cache",
        body: "Dear all, The main context could be found as follows: Event: Sport Centre 2026 XJTLU Fencing Competition."
      })],
      "en"
    );
  });

  it("restores the inbox scroll position after returning from an email detail", async () => {
    const messages = Array.from({ length: 20 }, (_, index) => {
      const position = index + 1;
      return {
        ...mockData.baseMessages[0],
        id: `mail-${position}`,
        subject: `Scroll Subject ${position}`,
        snippet: `Scroll Snippet ${position}`,
        body: "",
        summaryBullets: [`Scroll Snippet ${position}`],
        fullLoaded: position <= 15
      };
    });
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.getEmailMessage.mockImplementation(async (id: string) => {
      const email = messages.find((item) => item.id === id) || messages[0];
      return {
        ...email,
        body: `Scroll full body for ${id}`
      };
    });

    render(<App />);

    await screen.findByText("Scroll Subject 18");
    const scrollContainer = document.querySelector(".screen-scroll") as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", { configurable: true, writable: true, value: 760 });

    fireEvent.click(screen.getByText("Scroll Subject 18").closest("button") as HTMLElement);
    scrollContainer.scrollTop = 0;
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await screen.findByText("Scroll Subject 18");
    expect(scrollContainer.scrollTop).toBe(760);
  });

  it("sends ranked email candidates to AI search instead of the first mailbox page", async () => {
    const messages = [
      {
        ...mockData.baseMessages[0],
        id: "accommodation",
        senderName: "Accommodation.TC",
        senderEmail: "accommodation@example.edu",
        subject: "【再次提醒】2026年西浦创业家公寓",
        snippet: "考试结束后尽快完成退宿安排。",
        body: "考试结束后尽快完成退宿安排。",
        fallbackCategoryId: "deadline",
        fallbackCategoryIds: ["deadline"],
        priority: "high"
      },
      {
        ...mockData.baseMessages[0],
        id: "career",
        senderName: "XJTLU Career Centre",
        senderEmail: "career@example.edu",
        subject: "【邀请函】SCDA模拟面试大赛",
        snippet: "Mock interview competition.",
        body: "Mock interview competition.",
        fallbackCategoryId: "career-internship",
        fallbackCategoryIds: ["career-internship"],
        priority: "high"
      },
      {
        ...mockData.baseMessages[0],
        id: "lecture",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Week 10 Lecture & Lab",
        snippet: "DTS206TC week 10 lecture and lab arrangement.",
        body: "DTS206TC week 10 lecture and lab arrangement.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium"
      },
      {
        ...mockData.baseMessages[0],
        id: "exam",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "Final Exam Schedule and room arrangement for DTS206TC.",
        body: "The final exam schedule is available in this message.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high"
      }
    ];
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);

    render(<App />);

    await screen.findByText("DTS206TC-2526-S2: Final Exam Schedule");
    fireEvent.click(screen.getByText("AI"));
    fireEvent.change(screen.getByPlaceholderText("Search or ask about mail..."), {
      target: { value: "chaoqun老师考试安排时间" }
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(mockData.askAssistant).toHaveBeenCalled());
    const sentEmails = mockData.askAssistant.mock.calls[0][2];
    expect(sentEmails.slice(0, 2).map((email: { id: string }) => email.id)).toEqual(["exam", "lecture"]);
    expect(sentEmails.map((email: { id: string }) => email.id)).not.toContain("accommodation");
  });

  it("prepares generated summaries before citation results are expanded", async () => {
    const messages = [
      {
        ...mockData.baseMessages[0],
        id: "lecture",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Week 10 Lecture & Lab",
        snippet: "Bayesian Regression Models will be the final part of this module.",
        body: "Bayesian Regression Models will be the final part of this module and is important for the exam.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: ["DTS206TC-2526-S2: Week 10 Lecture & Lab"],
        fullLoaded: true
      },
      {
        ...mockData.baseMessages[0],
        id: "exam",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "Final Exam Schedule and room arrangement for DTS206TC.",
        body: "The final exam will take place on 11 June 2026, from 2:00 PM to 4:00 PM.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: ["DTS206TC-2526-S2: Final Exam Schedule"],
        fullLoaded: true
      }
    ];
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);
    mockData.askAssistant.mockResolvedValue({
      title: "DTS206TC Final Exam Schedule",
      lines: ["The final exam date and time are in the DTS206TC exam schedule email."]
    });
    mockData.analyzeInbox.mockImplementation(async (items: typeof messages) =>
      items.map((email) => email.id === "exam"
        ? {
            id: email.id,
            summaryBullets: [
              "The final exam for DTS206TC is scheduled for 11 June 2026.",
              "The exam will take place from 2:00 PM to 4:00 PM."
            ],
            categoryId: "course",
            categoryIds: ["course", "deadline"]
          }
        : {
            id: email.id,
            summaryBullets: ["Week 10 covers Bayesian Regression Models for DTS206TC."],
            categoryId: "course",
            categoryIds: ["course"]
          })
    );

    render(<App />);

    await screen.findByText("DTS206TC-2526-S2: Final Exam Schedule");
    fireEvent.click(screen.getByText("AI"));
    fireEvent.change(screen.getByPlaceholderText("Search or ask about mail..."), {
      target: { value: "what is the final test date of DTS206TC?" }
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(mockData.analyzeInbox).toHaveBeenCalled());
    expect(mockData.analyzeInbox.mock.calls[0][0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "exam", summaryBullets: [] })])
    );
    expect(mockData.analyzeInbox.mock.calls[0][1]).toBe("en");

    expect(screen.queryByText("The final exam for DTS206TC is scheduled for 11 June 2026.")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Expand summary" })[0]);

    expect(await screen.findByText("The final exam for DTS206TC is scheduled for 11 June 2026.")).toBeTruthy();
    expect(screen.getByText("The exam will take place from 2:00 PM to 4:00 PM.")).toBeTruthy();
    const expandedCitation = document.querySelector(".ai-citation-expanded") as HTMLElement;
    expect(within(expandedCitation).queryByText("DTS206TC-2526-S2: Final Exam Schedule")).toBeNull();
  });

  it("sends only matching course-prefix candidates for DTS searches", async () => {
    const messages = [
      {
        ...mockData.baseMessages[0],
        id: "accommodation",
        senderName: "Accommodation.TC",
        senderEmail: "accommodation@example.edu",
        subject: "【再次提醒】2026年西浦创业家公寓",
        snippet: "宿舍调整安排及住宿安全提醒。",
        body: "学生需按时间节点办理住宿手续。",
        fallbackCategoryId: "deadline",
        fallbackCategoryIds: ["deadline"],
        priority: "high"
      },
      {
        ...mockData.baseMessages[0],
        id: "dts202",
        senderName: "Angelos Stefanidis",
        senderEmail: "teacher@example.edu",
        subject: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
        snippet: "DTS202TC marking review completed.",
        body: "DTS202TC marking review completed.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium"
      },
      {
        ...mockData.baseMessages[0],
        id: "ent208",
        senderName: "ENT Tutor",
        senderEmail: "ent@example.edu",
        subject: "ENT208TC Project Feedback",
        snippet: "ENT208 feedback.",
        body: "ENT208 feedback.",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium"
      }
    ];
    mockData.messages = messages;
    mockData.getGmailMessages.mockResolvedValue(messages);

    render(<App />);

    await screen.findByText("DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED");
    fireEvent.click(screen.getByText("AI"));
    fireEvent.change(screen.getByPlaceholderText("Search or ask about mail..."), {
      target: { value: "查找DTS邮件" }
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(mockData.askAssistant).toHaveBeenCalled());
    const sentEmails = mockData.askAssistant.mock.calls[0][2];
    expect(sentEmails.map((email: { id: string }) => email.id)).toEqual(["dts202"]);
  });
});
