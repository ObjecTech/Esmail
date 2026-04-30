import { describe, expect, it } from "vitest";
import { buildSmtpMessage, decodeMimeBody, decodeMimeWords } from "./qqMail.mjs";

describe("QQ mail helpers", () => {
  it("decodes UTF-8 MIME words from IMAP headers", () => {
    const encoded = "=?UTF-8?B?5rWL6K+V6YKu5Lu2?=";

    expect(decodeMimeWords(encoded)).toBe("测试邮件");
  });

  it("builds SMTP messages with encoded non-ascii subjects", () => {
    const message = buildSmtpMessage({
      from: "qingnei@qq.com",
      to: "classmate@example.com",
      subject: "作业进度",
      body: "我会今天更新。"
    });

    expect(message).toContain("From: qingnei@qq.com");
    expect(message).toContain("To: classmate@example.com");
    expect(message).toContain("Subject: =?UTF-8?B?");
    expect(message).toContain("我会今天更新。");
  });

  it("decodes quoted-printable QQ message bodies and removes IMAP wrappers", () => {
    const raw = [
      "* 1 FETCH (UID 12 BODY[TEXT]<0> {3166}",
      "--_000_boundary",
      "Content-Type: text/plain; charset=\"Windows-1252\"",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Dear Zhanyuan Ning, This is to remind you to complete the AY2025-26=0D=0A",
      "Semester 2 Module Questionnaire for ENT208TC.",
      "--_000_boundary--",
      ")",
      "B1 OK FETCH completed"
    ].join("\r\n");

    expect(decodeMimeBody(raw)).toContain("Dear Zhanyuan Ning");
    expect(decodeMimeBody(raw)).toContain("AY2025-26 Semester 2 Module Questionnaire");
    expect(decodeMimeBody(raw)).not.toContain("BODY[TEXT]");
    expect(decodeMimeBody(raw)).not.toContain("Content-Transfer-Encoding");
  });

  it("decodes base64 QQ message bodies", () => {
    const body = Buffer.from("This paper notification has been updated.", "utf8").toString("base64");
    const raw = [
      "BODY[TEXT]<0> {12456}",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      body
    ].join("\r\n");

    expect(decodeMimeBody(raw)).toBe("This paper notification has been updated.");
  });

  it("decodes raw base64 body previews when QQ omits MIME part headers", () => {
    const text = "Dear author, your ICCCN2026 notification for paper 278 is ready. ".repeat(2);
    const raw = [
      "BODY[TEXT]<0> {12456}",
      Buffer.from(text, "utf8").toString("base64")
    ].join("\r\n");

    expect(decodeMimeBody(raw)).toContain("ICCCN2026 notification for paper 278");
    expect(decodeMimeBody(raw)).not.toContain("BODY[TEXT]");
  });
});
