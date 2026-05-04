import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposeScreen } from "./ComposeScreen";

function renderCompose(overrides: Partial<React.ComponentProps<typeof ComposeScreen>> = {}) {
  const props: React.ComponentProps<typeof ComposeScreen> = {
    accountEmail: "3563750980@qq.com",
    canSend: true,
    language: "zh",
    onClose: vi.fn(),
    onGenerateDraft: vi.fn().mockResolvedValue({ subject: "测试主题", body: "测试正文" }),
    onSendEmail: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };

  render(<ComposeScreen {...props} />);
  return props;
}

describe("ComposeScreen", () => {
  it("uses a red discard action instead of the more menu", () => {
    renderCompose();

    const discard = screen.getByRole("button", { name: "丢弃" });

    expect(discard.className).toContain("discard-action");
    expect(screen.queryByLabelText("更多")).toBeNull();
  });

  it("closes the composer when discarding an empty draft", () => {
    const props = renderCompose();

    fireEvent.click(screen.getByRole("button", { name: "丢弃" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
