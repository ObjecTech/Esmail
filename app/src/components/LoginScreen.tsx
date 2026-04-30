import { ArrowRight, Chrome, KeyRound, Languages, Loader2, Mail, Server, ShieldCheck, Sparkles } from "lucide-react";
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
  const [imapHost, setImapHost] = useState("imap.qq.com");
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState("smtp.qq.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isZh = language === "zh";

  async function submitQq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(isZh ? "正在验证 IMAP 和 SMTP..." : "Verifying IMAP and SMTP...");
    try {
      await onQqLogin({ email, authCode, imapHost, imapPort, smtpHost, smtpPort });
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
          <h1>{isZh ? "先登录邮箱，再进入智能收件箱" : "Sign in before opening your intelligent inbox"}</h1>
          <p>{isZh ? "支持 Google OAuth，也支持 QQ 邮箱授权码登录 IMAP / SMTP。" : "Use Google OAuth or connect QQ Mail with IMAP / SMTP credentials."}</p>
        </div>

        <div className="login-methods">
          <button className="google-login-button" disabled={loading || isSubmitting} onClick={onGoogleLogin} type="button">
            <Chrome size={23} />
            <span>{isZh ? "使用 Google 登录" : "Continue with Google"}</span>
            <ArrowRight size={21} />
          </button>

          <form className="qq-login-form" onSubmit={(event) => void submitQq(event)}>
            <div className="login-section-title">
              <ShieldCheck size={22} />
              <span>{isZh ? "QQ 邮箱 IMAP / SMTP" : "QQ Mail IMAP / SMTP"}</span>
            </div>
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
              <span>{isZh ? "邮箱授权码" : "Mail authorization code"}</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setAuthCode(event.target.value)}
                placeholder={isZh ? "不是 QQ 密码" : "Not your QQ password"}
                required
                type="password"
                value={authCode}
              />
            </label>
            <div className="mail-server-grid">
              <label>
                <span><Server size={15} /> IMAP</span>
                <input onChange={(event) => setImapHost(event.target.value)} required value={imapHost} />
              </label>
              <label>
                <span>{isZh ? "端口" : "Port"}</span>
                <input onChange={(event) => setImapPort(Number(event.target.value))} required type="number" value={imapPort} />
              </label>
              <label>
                <span><Server size={15} /> SMTP</span>
                <input onChange={(event) => setSmtpHost(event.target.value)} required value={smtpHost} />
              </label>
              <label>
                <span>{isZh ? "端口" : "Port"}</span>
                <input onChange={(event) => setSmtpPort(Number(event.target.value))} required type="number" value={smtpPort} />
              </label>
            </div>
            <button className="qq-submit-button" disabled={loading || isSubmitting} type="submit">
              {isSubmitting ? <Loader2 className="spin" size={20} /> : <KeyRound size={20} />}
              <span>{isZh ? "验证并进入 Esmail" : "Verify and enter Esmail"}</span>
            </button>
          </form>
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
