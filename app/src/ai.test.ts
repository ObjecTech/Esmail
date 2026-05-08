import { describe, expect, it } from "vitest";
import { findRelevantEmailCitations, generateDraft, getAssistantReply } from "./ai";
import type { Email } from "./types";

describe("mock AI helpers", () => {
  it("keeps assistant replies concise", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件");

    expect(reply.lines.length).toBeLessThanOrEqual(3);
  });

  it("generates an editable draft", () => {
    const draft = generateDraft("礼貌回复老师，说明我会在周五前提交", "中文", "专业");

    expect(draft.subject.length).toBeGreaterThan(0);
    expect(draft.body).toContain("周五前");
  });

  it("returns English assistant replies when the app language is English", () => {
    const reply = getAssistantReply("Summarize important unread emails", "en");

    expect(reply.title).toBe("Important unread");
    expect(reply.lines.join(" ")).toContain("OpenAI");
    expect(reply.lines.join(" ")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("uses provided emails for important mail summaries", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件", "zh", [
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: []
      }
    ]);

    expect(reply.title).toBe("重要邮件");
    expect(reply.lines[0]).toContain("ENT208 feedback");
  });

  it("uses searched email content for generic fallback answers", () => {
    const reply = getAssistantReply("DTS208week11 需要带什么", "en", [
      {
        id: "dts208-week11",
        senderName: "Yuxuan Zhao",
        senderEmail: "teacher@example.edu",
        subject: "DTS208TC-2526-S2: DTS208TC: Week 11 Lab Arrangement (CW1 Code Check)",
        snippet: "Bring your own laptop and code to the lab session.",
        body: "Week 11 lab is dedicated to checking CW1 code consistency with your report. Bring your own laptop and code to the lab session.",
        dateLabel: "5/4",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "high",
        summaryBullets: [
          "Week 11 lab checks CW1 code consistency with your report.",
          "Bring your own laptop and code to the lab session."
        ]
      }
    ]);

    expect(reply.title).toContain("DTS208TC");
    expect(reply.lines.join(" ")).toContain("Yuxuan Zhao");
    expect(reply.lines.join(" ")).toContain("Bring your own laptop");
    expect(reply.title).not.toBe("Mail assistant");
  });

  it("summarizes important mail even when Gmail marks it as read", () => {
    const reply = getAssistantReply("总结今天未读的重要邮件", "zh", [
      {
        id: "gmail-1",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "Read but important",
        snippet: "Please revise before Friday.",
        body: "Please revise before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "important",
        priority: "high",
        summaryBullets: [],
        unread: false
      }
    ]);

    expect(reply.lines[0]).toContain("Read but important");
  });

  it("generates English drafts from the English app language", () => {
    const draft = generateDraft("politely reply and confirm I will submit before Friday", "en", "Professional");

    expect(draft.subject).toContain("Follow-up");
    expect(draft.body).toContain("before Friday");
    expect(draft.body).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("finds remembered coursework emails by natural language", () => {
    const emails: Email[] = [
      {
        id: "marketing",
        senderName: "Agoda",
        senderEmail: "deals@agoda.com",
        subject: "酒店优惠信息",
        snippet: "本周酒店优惠。",
        body: "查找 Agoda 的酒店优惠信息。",
        dateLabel: "昨天",
        fallbackCategoryId: "others",
        fallbackCategoryIds: ["others"],
        priority: "low",
        summaryBullets: ["酒店优惠。"]
      },
      {
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
      }
    ];

    const citations = findRelevantEmailCitations("我之前看到一封 coursework 的邮件，帮我找一下", emails, "zh");

    expect(citations[0]?.email.id).toBe("coursework");
    expect(citations[0]?.excerpt).toContain("Coursework 1");
  });

  it("prioritizes high-priority deadline mail for important summary prompts", () => {
    const emails: Email[] = [
      {
        id: "newsletter",
        senderName: "Newsletter",
        senderEmail: "news@example.com",
        subject: "Weekly update",
        snippet: "No action needed.",
        body: "No action needed.",
        dateLabel: "今天",
        fallbackCategoryId: "others",
        fallbackCategoryIds: ["others"],
        priority: "low",
        summaryBullets: ["普通更新。"],
        unread: true
      },
      {
        id: "deadline",
        senderName: "Tutor",
        senderEmail: "tutor@student.edu",
        subject: "ENT208 feedback due Friday",
        snippet: "Please revise the validation section before Friday.",
        body: "Please revise the validation section before Friday.",
        dateLabel: "今天",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: ["周五前修订验证部分。"],
        unread: false
      }
    ];

    const citations = findRelevantEmailCitations("总结今天未读的重要邮件", emails, "zh");

    expect(citations[0]?.email.id).toBe("deadline");
    expect(citations[0]?.matchLabel).toMatch(/match|匹配/);
  });

  it("uses assistant answer context to cite the exam schedule instead of unrelated high-priority mail", () => {
    const emails: Email[] = [
      {
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
      },
      {
        id: "coursework",
        senderName: "Do not reply to this email (via LM Core)",
        senderEmail: "no-reply@lmcore.edu",
        subject: "You have submitted your assignment submission for Coursework 1",
        snippet: "You have submitted your assignment submission for Coursework 1",
        body: "Do not reply to this email. You have submitted your assignment submission for Coursework 1.",
        dateLabel: "4/28",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: ["Coursework 1 已提交。"]
      },
      {
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
      }
    ];

    const citations = findRelevantEmailCitations(
      [
        "王超群老师对于考试的安排在哪里",
        "DTS206TC-2526-S2: Final Exam Schedule",
        "发件人：Chaoqun Wang",
        "内容/位置：邮件主题为 Final Exam Schedule，说明考试安排已通过该邮件发送。"
      ].join("\n"),
      emails,
      "zh"
    );

    expect(citations.map((citation) => citation.email.id)).toEqual(["exam"]);
  });

  it("only returns citation cards with at least 70 percent match", () => {
    const emails: Email[] = [
      {
        id: "weak",
        senderName: "Events",
        senderEmail: "events@example.edu",
        subject: "Campus news",
        snippet: "There is one brief exam mention in this newsletter.",
        body: "There is one brief exam mention in this newsletter.",
        dateLabel: "今天",
        fallbackCategoryId: "others",
        fallbackCategoryIds: ["others"],
        priority: "low",
        summaryBullets: ["General newsletter."]
      },
      {
        id: "strong",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "Final Exam Schedule and room arrangement for DTS206TC.",
        body: "The final exam timetable and room arrangement are included here.",
        dateLabel: "4/30",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: ["考试时间和地点安排在 Final Exam Schedule 邮件中。"]
      }
    ];

    const citations = findRelevantEmailCitations("考试安排 Final Exam Schedule", emails, "zh");

    expect(citations.map((citation) => citation.email.id)).toEqual(["strong"]);
    expect(citations.every((citation) => Number.parseInt(citation.matchLabel, 10) >= 70)).toBe(true);
  });

  it("does not show unrelated accommodation mail when a teacher name anchors the search", () => {
    const emails: Email[] = [
      {
        id: "exam",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Final Exam Schedule",
        snippet: "DTS206TC-2526-S2: Final Exam Schedule",
        body: "Final exam schedule and room arrangement for DTS206TC.",
        dateLabel: "4/30",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course", "deadline"],
        priority: "high",
        summaryBullets: ["Final Exam Schedule."]
      },
      {
        id: "lecture",
        senderName: "Chaoqun Wang",
        senderEmail: "Chaoqun.Wang@xjtlu.edu.cn",
        subject: "DTS206TC-2526-S2: Week 10 Lecture & Lab",
        snippet: "DTS206TC week 10 lecture and lab arrangement.",
        body: "Week 10 lecture and lab announcement by Chaoqun Wang.",
        dateLabel: "5/4",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: ["Week 10 lecture and lab."]
      },
      {
        id: "accommodation",
        senderName: "Accommodation.TC",
        senderEmail: "accommodation@example.edu",
        subject: "【再次提醒】2026年西浦创业家公寓",
        snippet: "宿舍调整安排及住宿安全提醒。",
        body: "学生需在期末考试结束后尽快完成退宿安排，请按时间节点办理。",
        dateLabel: "今天",
        fallbackCategoryId: "deadline",
        fallbackCategoryIds: ["deadline"],
        priority: "high",
        summaryBullets: ["请按时间节点办理退宿。"]
      }
    ];

    const citations = findRelevantEmailCitations(
      [
        "chaoqun老师什么时候安排考试时间",
        "标题：DTS206TC-2526-S2: Final Exam Schedule（发件人：Chaoqun Wang）",
        "邮件主题为期末考试安排（Final Exam Schedule）。",
        "发件日期：4/30，来自 Chaoqun Wang。"
      ].join("\n"),
      emails,
      "zh"
    );

    expect(citations.map((citation) => citation.email.id)).toEqual(["exam", "lecture"]);
    expect(citations.every((citation) => Number.parseInt(citation.matchLabel, 10) < 99)).toBe(true);
  });

  it("treats DTS course searches as a course-code prefix instead of generic text", () => {
    const emails: Email[] = [
      {
        id: "accommodation",
        senderName: "Accommodation.TC",
        senderEmail: "accommodation@example.edu",
        subject: "【再次提醒】2026年西浦创业家公寓",
        snippet: "宿舍调整安排及住宿安全提醒。",
        body: "学生需按时间节点办理住宿手续。",
        dateLabel: "今天",
        fallbackCategoryId: "deadline",
        fallbackCategoryIds: ["deadline"],
        priority: "high",
        summaryBullets: ["请按时间节点办理住宿。"]
      },
      {
        id: "dts202",
        senderName: "Angelos Stefanidis",
        senderEmail: "teacher@example.edu",
        subject: "DTS202TC-2526-S1: DTS202TC - Marking Review COMPLETED",
        snippet: "DTS202TC marking review completed.",
        body: "DTS202TC marking review completed.",
        dateLabel: "5/5",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: ["DTS202TC marking review completed."]
      },
      {
        id: "ent208",
        senderName: "ENT Tutor",
        senderEmail: "ent@example.edu",
        subject: "ENT208TC Project Feedback",
        snippet: "ENT208 feedback.",
        body: "ENT208 feedback.",
        dateLabel: "5/3",
        fallbackCategoryId: "course",
        fallbackCategoryIds: ["course"],
        priority: "medium",
        summaryBullets: ["ENT208 feedback."]
      }
    ];

    const citations = findRelevantEmailCitations(
      [
        "查找DTS邮件",
        "邮件助手",
        "我会优先找出需要你行动的邮件。",
        "摘要会保持在三条以内。"
      ].join("\n"),
      emails,
      "zh"
    );

    expect(citations.map((citation) => citation.email.id)).toEqual(["dts202"]);
  });

});
