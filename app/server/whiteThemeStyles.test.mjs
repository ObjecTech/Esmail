import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve("src/styles.css"), "utf8");

function ruleFor(selector) {
  const rulePattern = /([^{}]+)\{([^}]*)\}/g;
  for (const match of css.matchAll(rulePattern)) {
    const selectors = match[1].split(",").map((item) => item.trim());
    if (selectors.includes(selector)) return match[2];
  }
  return "";
}

describe("white theme styles", () => {
  it("adapts AI, compose, and todo surfaces away from dark theme colors", () => {
    expect(ruleFor('.phone-stage[data-theme="white"] .ai-suggestions button')).toContain("color: #2f3746");
    expect(ruleFor('.phone-stage[data-theme="white"] .ai-input-box')).toContain("background: #fff");
    expect(ruleFor('.phone-stage[data-theme="white"] .compose-fields input')).toContain("color: #111318");
    expect(ruleFor('.phone-stage[data-theme="white"] .signature')).toContain("color: #606775");
    expect(ruleFor('.phone-stage[data-theme="white"] .todo-item')).toContain("background: #fff");
  });

  it("adapts custom view controls away from dark theme colors", () => {
    expect(ruleFor('.phone-stage[data-theme="white"] .custom-card')).toContain("background: #fff");
    expect(ruleFor('.phone-stage[data-theme="white"] .category-check')).toContain("color: #111318");
    expect(ruleFor('.phone-stage[data-theme="white"] .filter-row')).toContain("color: #111318");
    expect(ruleFor('.phone-stage[data-theme="white"] .filter-indicator')).toContain("background: #edf2f8");
    expect(ruleFor('.phone-stage[data-theme="white"] .rule-value-input')).toContain("background: #fff");
    expect(ruleFor('.phone-stage[data-theme="white"] .rule-row strong')).toContain("color: #147dff");
  });
});
