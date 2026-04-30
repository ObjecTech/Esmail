import { ArrowUp, AtSign, Camera, File, Globe2, Image, MoreHorizontal, Paperclip, SendHorizonal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Draft, Language } from "../types";
import { IconButton } from "./IconButton";

interface ComposeScreenProps {
  accountEmail: string;
  canSend: boolean;
  language: Language;
  onClose: () => void;
  onGenerateDraft: (idea: string, draftLanguage: string, tone: string) => Promise<Draft>;
  onSendEmail: (payload: { to: string; subject: string; body: string }) => Promise<void>;
}

export function ComposeScreen({ accountEmail, canSend, language, onClose, onGenerateDraft, onSendEmail }: ComposeScreenProps) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [idea, setIdea] = useState("");
  const [draftLanguage, setDraftLanguage] = useState(language === "zh" ? "中文" : "English");
  const [tone, setTone] = useState(language === "zh" ? "专业" : "Professional");
  const [status, setStatus] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftLanguage(language === "zh" ? "中文" : "English");
    setTone(language === "zh" ? "专业" : "Professional");
  }, [language]);

  async function generate() {
    const fallbackIdea = language === "zh" ? "礼貌回复并确认时间" : "Politely reply and confirm the timing";
    setIsGenerating(true);
    setStatus(language === "zh" ? "Esmail AI 正在起草..." : "Esmail AI is drafting...");
    try {
      const draft = await onGenerateDraft(idea || fallbackIdea, draftLanguage, tone);
      setSubject((current) => current || draft.subject);
      setBody(draft.body);
      setStatus(language === "zh" ? "草稿已生成" : "Draft ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : language === "zh" ? "草稿生成失败" : "Draft failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function send() {
    if (!canSend) {
      setStatus(language === "zh" ? "请先连接 Google 邮箱再发送。" : "Connect Google Mail before sending.");
      return;
    }
    if (!recipient.trim() || !subject.trim() || !body.trim()) {
      setStatus(language === "zh" ? "请填写收件人、主题和正文。" : "Fill in recipient, subject, and body.");
      return;
    }
    const ok = window.confirm(
      language === "zh"
        ? `确认发送给 ${recipient}？${attachments.length ? `\n已选择 ${attachments.length} 个附件。` : ""}`
        : `Send this email to ${recipient}?${attachments.length ? `\n${attachments.length} attachment(s) selected.` : ""}`
    );
    if (!ok) return;

    setIsSending(true);
    setStatus(language === "zh" ? "正在通过 Gmail 发送..." : "Sending through Gmail...");
    try {
      await onSendEmail({ to: recipient, subject, body });
      setStatus(language === "zh" ? "邮件已发送" : "Email sent");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : language === "zh" ? "发送失败" : "Send failed");
    } finally {
      setIsSending(false);
    }
  }

  const copy = {
    close: language === "zh" ? "关闭写信" : "Close compose",
    signature: language === "zh" ? "签名" : "Signature",
    attachment: language === "zh" ? "附件" : "Attachment",
    send: language === "zh" ? "发送" : "Send",
    more: language === "zh" ? "更多" : "More",
    to: language === "zh" ? "发送给:" : "To:",
    from: language === "zh" ? "来自:" : "From:",
    subject: language === "zh" ? "主题" : "Subject",
    bodyPlaceholder: language === "zh" ? "直接在这里输入，或者使用 AI 写作" : "Type here, or write with AI",
    aiHelp: language === "zh" ? "简单输入你想要写的内容，AI会帮你撰写邮件" : "Write a short idea and AI will draft the email.",
    ideaPlaceholder: language === "zh" ? "输入想法，AI 为你草拟邮件" : "Enter an idea, AI drafts the email",
    draftLabel: language === "zh" ? "生成草稿" : "Generate draft",
    sentWithoutLogin: language === "zh" ? "未连接 Gmail 时只能保存草稿" : "Connect Gmail to send",
    aiBusy: language === "zh" ? "生成中" : "Drafting"
  };

  function handleFiles(files: FileList | null) {
    const names = Array.from(files || []).map((file) => file.name);
    if (!names.length) return;
    setAttachments((current) => [...current, ...names]);
    setAttachmentMenuOpen(false);
    setStatus(language === "zh" ? `已选择 ${names.length} 个附件` : `${names.length} attachment(s) selected`);
  }

  return (
    <section className="screen-section compose-screen">
      <header className="compose-toolbar">
        <IconButton label={copy.close} onClick={onClose}>
          <X size={30} />
        </IconButton>
        <div className="compose-actions">
          <IconButton active={attachmentMenuOpen} label={copy.attachment} onClick={() => setAttachmentMenuOpen((open) => !open)}>
            <Paperclip size={23} />
          </IconButton>
          <IconButton className="send-blue" disabled={isSending} label={copy.send} onClick={() => void send()}>
            <SendHorizonal size={23} />
          </IconButton>
          <IconButton label={copy.more}>
            <MoreHorizontal size={27} />
          </IconButton>
        </div>
      </header>

      {attachmentMenuOpen ? (
        <div className="attachment-menu">
          <button onClick={() => photoInputRef.current?.click()} type="button">
            <Image size={24} />
            <span>{language === "zh" ? "相册" : "Photos"}</span>
          </button>
          <button onClick={() => cameraInputRef.current?.click()} type="button">
            <Camera size={24} />
            <span>{language === "zh" ? "相机" : "Camera"}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} type="button">
            <File size={24} />
            <span>{language === "zh" ? "文件" : "Files"}</span>
          </button>
        </div>
      ) : null}
      <input ref={photoInputRef} className="visually-hidden-file" type="file" accept="image/*" multiple onChange={(event) => handleFiles(event.target.files)} />
      <input ref={cameraInputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" onChange={(event) => handleFiles(event.target.files)} />
      <input ref={fileInputRef} className="visually-hidden-file" type="file" multiple onChange={(event) => handleFiles(event.target.files)} />

      <div className="compose-fields">
        <label>
          <span>{copy.to}</span>
          <input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
        </label>
        <label>
          <span>{copy.from}</span>
          <input readOnly value={accountEmail} />
        </label>
        <label>
          <span>{copy.subject}</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
      </div>

      <textarea
        className="compose-body"
        onChange={(event) => setBody(event.target.value)}
        placeholder={copy.bodyPlaceholder}
        value={body}
      />

      <div className="signature">Sent with <span>Esmail</span></div>
      {attachments.length ? (
        <div className="attachment-chips">
          {attachments.map((name, index) => (
            <span key={`${name}-${index}`}>{name}</span>
          ))}
        </div>
      ) : null}
      {status ? <div className="compose-status">{status}</div> : null}
      {!canSend ? <div className="compose-status muted-status">{copy.sentWithoutLogin}</div> : null}

      <div className="compose-ai">
        <p>{copy.aiHelp}</p>
        <div className="compose-chips">
          <button
            onClick={() =>
              setTone((current) =>
                language === "zh" ? (current === "专业" ? "简洁" : "专业") : current === "Professional" ? "Concise" : "Professional"
              )
            }
            type="button"
          >
            <AtSign size={18} />
            {tone}
          </button>
          <button onClick={() => setDraftLanguage(draftLanguage === "中文" ? "English" : "中文")} type="button">
            <Globe2 size={18} />
            {draftLanguage}
          </button>
        </div>
        <div className="compose-ai-input">
          <Sparkles size={18} />
          <input
            onChange={(event) => setIdea(event.target.value)}
            placeholder={copy.ideaPlaceholder}
            value={idea}
          />
          <button disabled={isGenerating} onClick={() => void generate()} type="button" aria-label={copy.draftLabel}>
            <ArrowUp size={22} />
          </button>
        </div>
      </div>
    </section>
  );
}
