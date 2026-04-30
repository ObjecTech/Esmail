import { describe, expect, it } from "vitest";
import { text } from "./language";

describe("language text", () => {
  it("returns Chinese labels by default", () => {
    expect(text("zh", "inbox")).toBe("收件箱");
    expect(text("zh", "customView")).toBe("自定义视图");
  });

  it("returns English labels when language is English", () => {
    expect(text("en", "inbox")).toBe("Inbox");
    expect(text("en", "customView")).toBe("Custom View");
  });
});
