import { ArrowRight, ChevronDown, Chrome, CircleHelp, KeyRound, Languages, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Language } from "../types";
import { IconButton } from "./IconButton";

interface QqLoginPayload {
  email: string;
  authCode: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

interface LoginScreenProps {
  error: string;
  language: Language;
  loading: boolean;
  onGoogleLogin: () => void;
  onQqLogin: (payload: QqLoginPayload) => Promise<void>;
  onToggleLanguage: () => void;
}

export function LoginScreen({ error, language, loading, onGoogleLogin, onQqLogin, onToggleLanguage }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImapForm, setShowImapForm] = useState(false);
  const isZh = language === "zh";

  async function submitQq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(isZh ? "正在验证 QQ 邮箱授权..." : "Verifying QQ Mail authorization...");
    try {
      await onQqLogin({
        email,
        authCode,
        imapHost: "imap.qq.com",
        imapPort: 993,
        smtpHost: "smtp.qq.com",
        smtpPort: 465
      });
      setStatus(isZh ? "登录成功，正在进入邮箱..." : "Signed in. Opening mailbox...");
    } catch (loginError) {
      setStatus(loginError instanceof Error ? loginError.message : isZh ? "QQ 邮箱登录失败" : "QQ Mail sign-in failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-stage">
      <section className="login-shell" aria-label={isZh ? "Esmail 登录" : "Esmail sign in"}>
        <header className="login-header">
          <div className="login-brand-mark">
            <Mail size={30} />
            <Sparkles size={16} />
          </div>
          <IconButton label={isZh ? "切换语言" : "Switch language"} onClick={onToggleLanguage}>
            <Languages size={24} />
          </IconButton>
        </header>

        <div className="login-hero">
          <p className="login-kicker">Esmail</p>
        </div>

        <div className="login-methods">
          <button className="google-login-button" disabled={loading || isSubmitting} onClick={onGoogleLogin} type="button">
            <Chrome size={23} />
            <span>{isZh ? "使用 Google 登录" : "Continue with Google"}</span>
            <ArrowRight size={21} />
          </button>

          <button
            aria-expanded={showImapForm}
            className="imap-login-button"
            disabled={loading || isSubmitting}
            onClick={() => setShowImapForm((isVisible) => !isVisible)}
            type="button"
          >
            <ShieldCheck size={23} />
            <span>{isZh ? "使用 QQ 邮箱登录" : "Continue with QQ Mail"}</span>
            <ChevronDown className={showImapForm ? "chevron-open" : undefined} size={21} />
          </button>

          {showImapForm ? (
            <form className="qq-login-form" onSubmit={(event) => void submitQq(event)}>
              <label>
                <span>{isZh ? "QQ 邮箱" : "QQ Mail address"}</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@qq.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                <span className="auth-code-label">
                  {isZh ? "邮箱授权码" : "Mail authorization code"}
                  <button
                    aria-label={isZh ? "邮箱授权码说明" : "Mail authorization code help"}
                    className="auth-code-help"
                    type="button"
                  >
                    <CircleHelp size={15} />
                    <span className="auth-code-tip">
                      {isZh
                        ? "这不是 QQ 密码。请在 QQ 邮箱中进入：设置 -> 账号与安全 -> 安全设置 -> 生成授权码。"
                        : "This is not your QQ password. In QQ Mail, go to: Settings -> Account & Security -> Security Settings -> Generate authorization code."}
                    </span>
                  </button>
                </span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setAuthCode(event.target.value)}
                  placeholder={isZh ? "不是 QQ 密码" : "Not your QQ password"}
                  required
                  type="password"
                  value={authCode}
                />
              </label>
              <button className="qq-submit-button" disabled={loading || isSubmitting} type="submit">
                {isSubmitting ? <Loader2 className="spin" size={20} /> : <KeyRound size={20} />}
                <span>{isZh ? "验证并进入 Esmail" : "Verify and enter Esmail"}</span>
              </button>
            </form>
          ) : null}
        </div>

        {(status || error || loading) ? (
          <div className="login-status">
            {loading ? (isZh ? "正在检查登录状态..." : "Checking session...") : status || error}
          </div>
        ) : null}
      </section>
    </div>
  );
}
