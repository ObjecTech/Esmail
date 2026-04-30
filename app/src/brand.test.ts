import { describe, expect, it } from "vitest";
import { text } from "./language";
import { mockEmails } from "./mockData";

describe("Esmail branding", () => {
  it("uses Esmail instead of Filo in visible labels and seeded mail", () => {
    const visibleText = [
      text("zh", "esmailMail"),
      text("en", "esmailMail"),
      ...mockEmails.flatMap((email) => [
        email.subject,
        email.snippet,
        email.body,
        ...email.summaryBullets
      ])
    ].join("\n");

    expect(visibleText).toContain("Esmail");
    expect(visibleText).not.toMatch(/Filo/i);
  });
});
