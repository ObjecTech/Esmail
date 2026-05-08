import { describe, expect, it } from "vitest";
import { bodyStructureImageFromFetch, buildSmtpMessage, decodeMimeBody, decodeMimeContent, decodeMimeWords, extractBodyStructureImages, extractMimeImages } from "./qqMail.mjs";

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
    expect(decodeMimeBody(raw)).toContain("AY2025-26\nSemester 2 Module Questionnaire");
    expect(decodeMimeBody(raw)).not.toContain("BODY[TEXT]");
    expect(decodeMimeBody(raw)).not.toContain("Content-Transfer-Encoding");
  });

  it("preserves line breaks in decoded QQ plain text bodies", () => {
    const raw = [
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Dear Zhanyuan Ning,=0D=0A=0D=0A",
      "Congratulations! Your paper has been accepted.=0D=0A",
      "Paper ID: 278=0D=0A=0D=0A",
      "Best regards,=0D=0A",
      "ICCCN2026 TPC"
    ].join("\r\n");

    expect(decodeMimeBody(raw)).toBe([
      "Dear Zhanyuan Ning,",
      "",
      "Congratulations! Your paper has been accepted.",
      "Paper ID: 278",
      "",
      "Best regards,",
      "ICCCN2026 TPC"
    ].join("\n"));
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

  it("extracts inline images from QQ MIME messages", () => {
    const png = Buffer.from("fake-png", "utf8").toString("base64");
    const raw = [
      "* 1 FETCH (BODY[]<0> {500}",
      "Content-Type: multipart/related; boundary=\"b1\"",
      "",
      "--b1",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<p>Hello</p><img src=3D\"cid:logo\">",
      "--b1",
      "Content-Type: image/png; name=\"logo.png\"",
      "Content-Transfer-Encoding: base64",
      "Content-ID: <logo>",
      "Content-Disposition: inline; filename=\"logo.png\"",
      "",
      png,
      "--b1--",
      ")",
      "B1 OK FETCH completed"
    ].join("\r\n");

    const images = extractMimeImages(raw);

    expect(images).toHaveLength(1);
    expect(images[0].filename).toBe("logo.png");
    expect(images[0].dataUrl).toContain("data:image/png;base64,");
  });

  it("preserves nested HTML bodies and finds related inline images", () => {
    const png = Buffer.from("nested-png", "utf8").toString("base64");
    const raw = [
      "Content-Type: multipart/related; boundary=\"outer\"",
      "",
      "--outer",
      "Content-Type: multipart/alternative; boundary=\"inner\"",
      "",
      "--inner",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Plain fallback",
      "--inner",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<div><p>=E6=AD=A3=E6=96=87</p><img src=3D\"cid:logo\"></div>",
      "--inner--",
      "--outer",
      "Content-Type: image/png; name=\"logo.png\"",
      "Content-Transfer-Encoding: base64",
      "Content-ID: <logo>",
      "",
      png,
      "--outer--"
    ].join("\r\n");

    const content = decodeMimeContent(raw);
    const images = extractMimeImages(raw);

    expect(content.text).toContain("Plain fallback");
    expect(content.htmlBody).toContain("正文");
    expect(content.htmlBody).toContain("cid:logo");
    expect(images).toHaveLength(1);
    expect(images[0].contentId).toBe("logo");
  });

  it("does not render image-only MIME parts as garbled text", () => {
    const png = Buffer.from("\x89PNG\r\n\x1a\nposter-bytes", "binary").toString("base64");
    const raw = [
      "Content-Type: image/png; name=\"poster.png\"",
      "Content-Transfer-Encoding: base64",
      "Content-Disposition: inline; filename=\"poster.png\"",
      "",
      png
    ].join("\r\n");

    const content = decodeMimeContent(raw);
    const images = extractMimeImages(raw);

    expect(content.text).toBe("");
    expect(content.htmlBody).toBe("");
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/png");
  });

  it("extracts JPEG images when QQ sends them as generic binary attachments", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x45, 0x73, 0x6d, 0x61, 0x69, 0x6c]).toString("base64");
    const raw = [
      "Content-Type: multipart/related; boundary=\"b1\"",
      "",
      "--b1",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<p>Hello</p><img src=3D\"cid:photo\">",
      "--b1",
      "Content-Type: application/octet-stream; name=\"photo.jpg\"",
      "Content-Transfer-Encoding: base64",
      "Content-ID: <photo>",
      "Content-Disposition: inline; filename=\"photo.jpg\"",
      "",
      jpeg,
      "--b1--"
    ].join("\r\n");

    const images = extractMimeImages(raw);

    expect(images).toHaveLength(1);
    expect(images[0].filename).toBe("photo.jpg");
    expect(images[0].mimeType).toBe("image/jpeg");
    expect(images[0].dataUrl).toContain("data:image/jpeg;base64,");
  });

  it("finds inline JPEG parts from QQ BODYSTRUCTURE responses", () => {
    const bodyStructure = [
      "* 99 FETCH (UID 107 BODYSTRUCTURE (((\"TEXT\" \"PLAIN\" (\"charset\" \"utf-8\") NIL NIL \"BASE64\" 4416 58 NIL NIL NIL)",
      "(\"TEXT\" \"HTML\" (\"charset\" \"utf-8\") NIL NIL \"BASE64\" 36474 469 NIL NIL NIL) \"ALTERNATIVE\" (\"BOUNDARY\" \"inner\") NIL NIL)",
      "(\"IMAGE\" \"PNG\" (\"name\" \"image001.png\") \"image001.png@cid\" NIL \"BASE64\" 67670 NIL (\"inline\" (\"filename\" \"image001.png\" \"size\" \"49451\")) NIL)",
      "(\"IMAGE\" \"JPEG\" (\"name\" \"image002.jpg\") \"image002.jpg@cid\" NIL \"BASE64\" 9606 NIL (\"inline\" (\"filename\" \"image002.jpg\" \"size\" \"7018\")) NIL)",
      "(\"IMAGE\" \"JPEG\" (\"name\" \"image003.jpg\") \"image003.jpg@cid\" NIL \"BASE64\" 9606 NIL (\"inline\" (\"filename\" \"image003.jpg\" \"size\" \"7018\")) NIL)",
      "\"RELATED\" (\"BOUNDARY\" \"outer\") NIL NIL))",
      "A3 OK UID FETCH Completed"
    ].join("\r\n");

    const images = extractBodyStructureImages(bodyStructure);

    expect(images.map((image) => image.partNumber)).toEqual(["2", "3", "4"]);
    expect(images[1]).toMatchObject({
      filename: "image002.jpg",
      mimeType: "image/jpeg",
      contentId: "image002.jpg@cid"
    });
  });

  it("builds data URLs from separately fetched BODYSTRUCTURE image parts", () => {
    const image = bodyStructureImageFromFetch(
      {
        partNumber: "3",
        filename: "image002.jpg",
        mimeType: "image/jpeg",
        contentId: "image002.jpg@cid"
      },
      [
        "* 99 FETCH (UID 107 BODY[3]<0> {16}",
        "/9j/4ABFc21haWw=",
        ")",
        "A4 OK UID FETCH Completed"
      ].join("\r\n")
    );

    expect(image).toMatchObject({
      filename: "image002.jpg",
      mimeType: "image/jpeg",
      contentId: "image002.jpg@cid"
    });
    expect(image?.dataUrl).toBe("data:image/jpeg;base64,/9j/4ABFc21haWw=");
  });

  it("parses headerless multipart bodies without leaking binary parts into text", () => {
    const png = Buffer.from("poster-bytes", "utf8").toString("base64");
    const raw = [
      "--mixed",
      "Content-Type: image/png; name=\"poster.png\"",
      "Content-Transfer-Encoding: base64",
      "Content-Disposition: inline; filename=\"poster.png\"",
      "",
      png,
      "--mixed",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<div><p>=E6=AD=A3=E6=96=87</p></div>",
      "--mixed--"
    ].join("\r\n");

    const content = decodeMimeContent(raw);
    const images = extractMimeImages(raw);

    expect(content.text).toBe("正文");
    expect(content.htmlBody).toContain("正文");
    expect(content.text).not.toContain("poster-bytes");
    expect(images).toHaveLength(1);
  });
});
