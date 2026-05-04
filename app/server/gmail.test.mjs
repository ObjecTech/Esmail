import { describe, expect, it } from "vitest";
import { buildRawEmail, inlineImagesInHtml, mapGmailMessageToEmail, shortDateLabel } from "./gmail.mjs";

describe("gmail helpers", () => {
  it("maps Gmail API messages into Esmail email rows", () => {
    const message = {
      id: "gmail-1",
      internalDate: String(Date.UTC(2026, 3, 24)),
      payload: {
        headers: [
          { name: "From", value: "Tutor <tutor@student.edu>" },
          { name: "Subject", value: "ENT208 feedback" },
          { name: "Date", value: "Fri, 24 Apr 2026 09:00:00 +0800" }
        ],
        mimeType: "text/plain",
        body: {
          data: Buffer.from("Please revise the validation section before Friday.", "utf8").toString("base64url")
        }
      },
      snippet: "Please revise the validation section before Friday."
    };

    const email = mapGmailMessageToEmail(message);

    expect(email.id).toBe("gmail-1");
    expect(email.senderName).toBe("Tutor");
    expect(email.senderEmail).toBe("tutor@student.edu");
    expect(email.subject).toBe("ENT208 feedback");
    expect(email.body).toContain("validation section");
    expect(email.fallbackCategoryIds).toEqual(["course", "deadline"]);
  });

  it("builds a base64url raw email for Gmail send", () => {
    const raw = buildRawEmail({
      to: "classmate@example.com",
      from: "qingnei0@gmail.com",
      subject: "Project update",
      body: "I will send the draft before Friday."
    });

    const decoded = Buffer.from(raw, "base64url").toString("utf8");

    expect(decoded).toContain("To: classmate@example.com");
    expect(decoded).toContain("From: qingnei0@gmail.com");
    expect(decoded).toContain("Subject: Project update");
    expect(decoded).toContain("I will send the draft before Friday.");
  });

  it("prefers the Date header when formatting Gmail dates", () => {
    const label = shortDateLabel(String(Date.UTC(2026, 0, 1)), "Fri, 24 Apr 2026 23:30:00 +0800");

    expect(label).toContain("4");
    expect(label).toContain("24");
  });

  it("decodes non-utf8 Gmail message bodies using the part charset", () => {
    const message = {
      id: "gmail-gbk",
      internalDate: String(Date.UTC(2026, 3, 24)),
      payload: {
        headers: [
          { name: "From", value: "Teacher <teacher@example.edu>" },
          { name: "Subject", value: "Course notice" }
        ],
        parts: [
          {
            mimeType: "text/plain",
            headers: [{ name: "Content-Type", value: "text/plain; charset=gb2312" }],
            body: {
              data: Buffer.from([0xb2, 0xe2, 0xca, 0xd4]).toString("base64url")
            }
          }
        ]
      },
      snippet: ""
    };

    expect(mapGmailMessageToEmail(message).body).toBe("测试");
  });

  it("preserves Gmail HTML bodies and can inline content-id images", () => {
    const message = {
      id: "gmail-html",
      internalDate: String(Date.UTC(2026, 3, 24)),
      payload: {
        headers: [
          { name: "From", value: "Teacher <teacher@example.edu>" },
          { name: "Subject", value: "HTML notice" }
        ],
        parts: [
          {
            mimeType: "text/html",
            headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
            body: {
              data: Buffer.from("<div><p>Course image</p><img src=\"cid:hero\"></div>", "utf8").toString("base64url")
            }
          }
        ]
      },
      snippet: ""
    };

    const email = mapGmailMessageToEmail(message);
    const html = inlineImagesInHtml(email.htmlBody, [{ contentId: "hero", dataUrl: "data:image/png;base64,abc" }]);

    expect(email.body).toContain("Course image");
    expect(email.htmlBody).toContain("cid:hero");
    expect(html).toContain("data:image/png;base64,abc");
  });
});
