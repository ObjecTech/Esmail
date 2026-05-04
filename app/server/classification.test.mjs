import { describe, expect, it } from "vitest";
import { classifyEmailText } from "./classification.mjs";

describe("classification rules", () => {
  it("classifies course emails by three-letter three-digit subject prefix", () => {
    expect(classifyEmailText({ subject: "DTS206 Coursework feedback" })).toContain("course");
    expect(classifyEmailText({ subject: "DTS206TC-2526-S2: Final Exam Schedule" })).toContain("course");
    expect(classifyEmailText({ subject: "ENT208 technical document feedback" })).toContain("course");
  });

  it("classifies course emails when a three-letter course code appears in the body", () => {
    expect(classifyEmailText({ subject: "Final Exam Schedule", body: "Please check the DTS208 timetable." })).toContain("course");
  });

  it("does not classify course emails from stale LMCore sender names alone", () => {
    expect(classifyEmailText({ from: "Tutor via LMCore", subject: "Technical document feedback" })).not.toContain("course");
  });
});
