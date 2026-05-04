import { Check, Hexagon, Menu, Plus, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { useState } from "react";
import { categoryLabel, text } from "../language";
import { emailCategoryIds } from "../rules";
import type { AccountSession, Category, Email, Language, Todo } from "../types";
import { EmailRow } from "./EmailRow";
import { IconButton } from "./IconButton";

interface InboxScreenProps {
  activeCategoryId: string;
  categories: Category[];
  emails: Email[];
  gmailError: string;
  gmailStatus: "idle" | "loading" | "loaded" | "error";
  language: Language;
  mailboxTitle: string;
  searchQuery: string;
  session: AccountSession;
  showCategories: boolean;
  todos: Todo[];
  onAddAccount: () => void;
  onCategoryChange: (categoryId: string) => void;
  onConnectGoogle: () => void;
  onLogoutAccount: () => void;
  onOpenEmail: (email: Email) => void;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onSearchChange: (query: string) => void;
}

export function InboxScreen({
  activeCategoryId,
  categories,
  emails,
  gmailError,
  gmailStatus,
  language,
  mailboxTitle,
  searchQuery,
  session,
  showCategories,
  todos,
  onAddAccount,
  onCategoryChange,
  onConnectGoogle,
  onLogoutAccount,
  onOpenEmail,
  onOpenMenu,
  onOpenSettings,
  onSearchChange
}: InboxScreenProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const isSearching = searchQuery.trim().length > 0;
  const activeEmails = showCategories && !isSearching && activeCategoryId !== "all"
    ? emails.filter((email) => emailCategoryIds(email).includes(activeCategoryId))
    : emails;
  const accountInitial = (session.name || session.email || "G").slice(0, 2);
  const isQq = session.provider === "qq";
  const providerName = isQq ? (language === "zh" ? "QQ 邮箱" : "QQ Mail") : "Gmail";
  const connectLabel = isQq
    ? (language === "zh" ? "同步 QQ 邮箱" : "Sync QQ Mail")
    : (language === "zh" ? "连接 Google 邮箱" : "Connect Google Mail");
  const loadingLabel = language === "zh" ? `正在同步 ${providerName}` : `Syncing ${providerName}`;
  const errorLabel = language === "zh" ? `${providerName} 同步失败` : `${providerName} sync failed`;

  return (
    <section className="screen-section inbox-screen">
      <header className="inbox-header">
        <IconButton label="菜单" onClick={onOpenMenu}>
          <Menu size={28} />
          <span className="notification-dot" />
        </IconButton>
        <label className="search-ghost">
          <Search size={23} />
          <input
            aria-label={text(language, "search")}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={text(language, "search")}
            value={searchQuery}
          />
        </label>
        <IconButton className="profile-button" label="账户" onClick={() => setAccountMenuOpen((open) => !open)}>
          {session.picture ? <img alt="" src={session.picture} /> : <span>{accountInitial}</span>}
        </IconButton>
        <IconButton label="分类规则设置" onClick={onOpenSettings}>
          <SlidersHorizontal size={25} />
        </IconButton>
      </header>

      {accountMenuOpen ? (
        <div className="account-switcher-popover">
          <div className="account-switcher-head">
            <span>{language === "zh" ? "邮箱账户" : "Mail accounts"}</span>
            <button onClick={onOpenSettings} type="button" aria-label={language === "zh" ? "账户设置" : "Account settings"}>
              <Hexagon size={24} />
            </button>
            <button onClick={onAddAccount} type="button" aria-label={language === "zh" ? "增加账号" : "Add account"}>
              <Plus size={25} />
            </button>
          </div>
          <button className="account-switcher-all" onClick={() => setAccountMenuOpen(false)} type="button">
            <UserRound size={24} />
            <span>
              <strong>{language === "zh" ? "全部" : "All"}</strong>
              <small>{language === "zh" ? "1 邮箱账户" : "1 mail account"}</small>
            </span>
          </button>
          <button className="account-switcher-row" onClick={() => setAccountMenuOpen(false)} type="button">
            <div className="account-avatar account-switcher-avatar">
              {session.picture ? <img alt="" src={session.picture} /> : accountInitial}
            </div>
            <span>
              <strong>{session.name || session.email}</strong>
              <small>{session.email}</small>
            </span>
            <Check size={31} />
          </button>
          <button className="account-switcher-logout" onClick={onLogoutAccount} type="button">
            {language === "zh" ? "退出当前账号" : "Sign out"}
          </button>
        </div>
      ) : null}

      {showCategories ? (
        <div className="category-tabs" role="tablist" aria-label="邮件分类">
          <button
            className={`category-tab ${activeCategoryId === "all" ? "category-tab-active" : ""}`}
            onClick={() => onCategoryChange("all")}
            role="tab"
            style={{ "--tab-color": "#52b7ff" } as React.CSSProperties}
            type="button"
          >
            {language === "zh" ? "所有邮件" : "All Mail"}
          </button>
          {categories.map((category) => (
            <button
              className={`category-tab ${category.id === activeCategoryId ? "category-tab-active" : ""}`}
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              role="tab"
              style={{ "--tab-color": category.color } as React.CSSProperties}
              type="button"
            >
              {categoryLabel(category, language)}
            </button>
          ))}
        </div>
      ) : (
        <div className="mailbox-title-strip">{mailboxTitle}</div>
      )}

      <div className="mail-date-group">{language === "zh" ? "今天" : "Today"}</div>
      {gmailStatus === "idle" ? (
        <button className="gmail-connect-banner" onClick={onConnectGoogle} type="button">
          <strong>{connectLabel}</strong>
          <span>{language === "zh" ? "登录后读取真实邮件，并让 AI 自动总结和生成待办。" : "Load real mail and let AI summarize it."}</span>
        </button>
      ) : null}
      {gmailStatus === "loading" ? (
        <div className="gmail-connect-banner passive-banner">
          <strong>{loadingLabel}</strong>
          <span>{language === "zh" ? "Esmail 正在读取最近邮件并分析待办。" : "Esmail is loading recent messages and todos."}</span>
        </div>
      ) : null}
      {gmailStatus === "error" ? (
        <button className="gmail-connect-banner error-banner" onClick={onConnectGoogle} type="button">
          <strong>{errorLabel}</strong>
          <span>{gmailError || (language === "zh" ? "点击重新同步。" : "Click to sync again.")}</span>
        </button>
      ) : null}
      <div className="email-list">
        {activeEmails.map((email) => {
          const rowCategories = emailCategoryIds(email)
            .map((categoryId) => categories.find((item) => item.id === categoryId))
            .filter(Boolean) as Category[];
          const todo = todos.find((item) => item.emailId === email.id && item.status === "active");
          return (
            <EmailRow
              categories={rowCategories}
              email={email}
              key={email.id}
              language={language}
              onOpen={onOpenEmail}
              todo={todo}
            />
          );
        })}
        {activeEmails.length === 0 ? (
          <div className="quiet-empty">
            <p>{language === "zh" ? "这个分类暂时没有邮件。" : "No emails in this view."}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
