import { describe, expect, it } from "vitest";
import { parseMacProxySettings } from "./proxy.mjs";

describe("parseMacProxySettings", () => {
  it("uses the macOS HTTPS proxy when enabled", () => {
    const output = `
<dictionary> {
  HTTPEnable : 1
  HTTPPort : 7897
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7897
  HTTPSProxy : 127.0.0.1
}`;

    expect(parseMacProxySettings(output)).toBe("http://127.0.0.1:7897");
  });

  it("returns an empty value when the proxy is disabled", () => {
    expect(parseMacProxySettings("HTTPSEnable : 0\nHTTPEnable : 0")).toBe("");
  });
});
