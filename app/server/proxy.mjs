import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { ProxyAgent, setGlobalDispatcher } from "undici";

function proxyFromEnv() {
  return (
    process.env.ESMAIL_HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ""
  );
}

export function parseMacProxySettings(text) {
  const enabled = /HTTPSEnable\s*:\s*1/.test(text) || /HTTPEnable\s*:\s*1/.test(text);
  if (!enabled) return "";

  const httpsHost = text.match(/HTTPSProxy\s*:\s*([^\n]+)/)?.[1]?.trim();
  const httpsPort = text.match(/HTTPSPort\s*:\s*(\d+)/)?.[1]?.trim();
  if (httpsHost && httpsPort) return `http://${httpsHost}:${httpsPort}`;

  const httpHost = text.match(/HTTPProxy\s*:\s*([^\n]+)/)?.[1]?.trim();
  const httpPort = text.match(/HTTPPort\s*:\s*(\d+)/)?.[1]?.trim();
  if (httpHost && httpPort) return `http://${httpHost}:${httpPort}`;

  return "";
}

function proxyFromMacSystem() {
  if (platform() !== "darwin") return "";
  try {
    return parseMacProxySettings(execFileSync("scutil", ["--proxy"], { encoding: "utf8" }));
  } catch {
    return "";
  }
}

export function configureFetchProxy() {
  const proxyUrl = proxyFromEnv() || proxyFromMacSystem();
  if (!proxyUrl) return "";

  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  return proxyUrl;
}
