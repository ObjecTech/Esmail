import type { AssistantReply, Draft, Email, Language } from "./types";

function relevantEmails(prompt: string, emails: Email[]) {
  const normalized = prompt.toLowerCase();
  const wantsToday = prompt.includes("今天") || normalized.includes("today");
  const wantsImportant = prompt.includes("重要") || normalized.includes("important") || normalized.includes("urgent");
  const wantsUnread = prompt.includes("未读") || normalized.includes("unread");
  const priorityRank = { high: 0, medium: 1, low: 2 };

  function pick(options: { today: boolean; important: boolean; unread: boolean }) {
    return emails.filter((email) => {
      if (email.deleted || email.archived) return false;
      if (options.today && !["今天", "today"].includes(String(email.dateLabel).toLowerCase())) return false;
      if (options.important && email.priority !== "high" && (email.categoryId || email.fallbackCategoryId) !== "important") return false;
      if (options.unread && email.unread === false) return false;
      return true;
    });
  }

  const attempts = [
    { today: wantsToday, important: wantsImportant, unread: wantsUnread },
    { today: wantsToday, important: wantsImportant, unread: false },
    { today: false, important: wantsImportant, unread: false },
    { today: false, important: false, unread: false }
  ];
  const matched = attempts.map(pick).find((items) => items.length) || [];

  return matched
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 3);
}

export function getAssistantReply(prompt: string, language: Language = "zh", emails: Email[] = []): AssistantReply {
  const normalized = prompt.toLowerCase();
  const isEnglish = language === "en";

  if (prompt.includes("未读") || prompt.includes("重要") || normalized.includes("unread") || normalized.includes("important")) {
    const matched = relevantEmails(prompt, emails);
    if (matched.length) {
      return {
        title: isEnglish ? "Important mail" : "重要邮件",
        lines: matched.map((email) => `${email.senderName}: ${email.subject}`)
      };
    }

    if (isEnglish) {
      return {
        title: "Important unread",
        lines: ["OpenAI invite needs confirmation.", "ENT208 feedback is due before Friday.", "Google security alert needs no reply."]
      };
    }

    return {
      title: "重要未读",
      lines: ["OpenAI 邀请需要确认。", "ENT208 反馈需要周五前处理。", "Google 安全提醒无需回复。"]
    };
  }

  if (prompt.includes("日程") || normalized.includes("schedule") || normalized.includes("day")) {
    if (isEnglish) {
      return {
        title: "Today",
        lines: ["Confirm project feedback by 16:00.", "Review event signup email tonight."]
      };
    }

    return {
      title: "今日日程",
      lines: ["16:00 前确认项目反馈。", "晚上检查活动报名邮件。"]
    };
  }

  if (prompt.includes("写信风格") || normalized.includes("style")) {
    if (isEnglish) {
      return {
        title: "Writing style",
        lines: ["Short and direct.", "State the purpose first.", "Close politely with a clear time."]
      };
    }

    return {
      title: "写信风格",
      lines: ["简短直接。", "先说明目的，再给时间点。", "结尾保持礼貌。"]
    };
  }

  if (isEnglish) {
    return {
      title: "Mail assistant",
      lines: ["I will surface emails that need action first.", "Summaries stay within three short lines."]
    };
  }

  return {
    title: "邮件助手",
    lines: ["我会优先找出需要你行动的邮件。", "摘要会保持在三条以内。"]
  };
}

export function generateDraft(idea: string, language: string, tone: string): Draft {
  const isEnglish = language.toLowerCase().includes("english") || language.toLowerCase() === "en";
  const subject = isEnglish ? "Re: Follow-up" : "回复：事项确认";

  if (isEnglish) {
    return {
      subject,
      body: `Hi,\n\nThank you for the update. I will review this carefully and send my response before Friday.\n\nBest regards,\nQingnei\n\nTone: ${tone}\nIdea: ${idea}`
    };
  }

  return {
    subject,
    body: `您好，\n\n谢谢您的提醒。我会按照要求处理，并在周五前提交相关内容。\n\n此致\n青内\n\n写作风格：${tone}\n原始想法：${idea}`
  };
}
