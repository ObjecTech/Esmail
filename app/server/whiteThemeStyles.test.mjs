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
  it("keeps inbox mail cards a uniform height", () => {
    expect(ruleFor(".email-row")).toContain("height: 102px");
    expect(ruleFor(".email-row")).toContain("overflow: hidden");
  });

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

  it("keeps the Morandi palette separate from restored white", () => {
    const morandiTheme = ruleFor('.phone-stage[data-theme="morandi"]');

    expect(morandiTheme).toContain("--light-stage: #f6f1ea");
    expect(morandiTheme).toContain("--light-shell: #fbf8f2");
    expect(morandiTheme).toContain("--light-accent: #a9b7a1");
    expect(css).toContain('.phone-stage[data-theme="white"]');
    expect(css).toContain('.phone-stage[data-theme="morandi"]');
    expect(css).not.toContain('data-theme="eye"');
  });

  it("keeps Morandi detail menus readable on light panels", () => {
    const morandiMoreMenuButton = ruleFor('.phone-stage[data-theme="morandi"] .detail-more-menu button');

    expect(morandiMoreMenuButton).toContain("color: var(--light-text)");
    expect(morandiMoreMenuButton).toContain("background: var(--light-panel-strong)");
  });
});
