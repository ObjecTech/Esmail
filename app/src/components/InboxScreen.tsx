import { Archive, ArrowLeft, Check, Hexagon, MailCheck, Menu, MoreHorizontal, Plus, Search, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
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
  onArchiveEmails: (emailIds: string[]) => void;
  onAssignCategory: (emailIds: string[], categoryId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onConnectGoogle: () => void;
  onDeleteEmails: (emailIds: string[]) => void;
  onLogoutAccount: () => void;
  onMarkReadEmails: (emailIds: string[]) => void;
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
  onArchiveEmails,
  onAssignCategory,
  onCategoryChange,
  onConnectGoogle,
  onDeleteEmails,
  onLogoutAccount,
  onMarkReadEmails,
  onOpenEmail,
  onOpenMenu,
  onOpenSettings,
  onSearchChange
}: InboxScreenProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const isSearching = searchQuery.trim().length > 0;
  const activeEmails = showCategories && !isSearching && activeCategoryId !== "all"
    ? emails.filter((email) => emailCategoryIds(email).includes(activeCategoryId))
    : emails;
  const isSelectionMode = selectedEmailIds.length > 0;
  const allVisibleSelected = activeEmails.length > 0 && activeEmails.every((email) => selectedEmailIds.includes(email.id));
  const accountInitial = (session.name || session.email || "G").slice(0, 2);
  const isQq = session.provider === "qq";
  const providerName = isQq ? (language === "zh" ? "QQ 邮箱" : "QQ Mail") : "Gmail";
  const connectLabel = isQq
    ? (language === "zh" ? "同步 QQ 邮箱" : "Sync QQ Mail")
    : (language === "zh" ? "连接 Google 邮箱" : "Connect Google Mail");
  const loadingLabel = language === "zh" ? `正在同步 ${providerName}` : `Syncing ${providerName}`;
  const errorLabel = language === "zh" ? `${providerName} 同步失败` : `${providerName} sync failed`;
  const selectedCountLabel = language === "zh" ? `已选择 ${selectedEmailIds.length} 封邮件` : `${selectedEmailIds.length} emails selected`;

  function enterSelection(email: Email) {
    setAccountMenuOpen(false);
    setLabelMenuOpen(false);
    setSelectedEmailIds([email.id]);
  }

  function exitSelection() {
    setLabelMenuOpen(false);
    setSelectedEmailIds([]);
  }

  function toggleSelected(email: Email) {
    setSelectedEmailIds((current) => {
      if (current.includes(email.id)) return current.filter((id) => id !== email.id);
      return [...current, email.id];
    });
  }

  function toggleSelectAll() {
    setSelectedEmailIds(allVisibleSelected ? [] : activeEmails.map((email) => email.id));
  }

  function runBulkAction(action: (emailIds: string[]) => void) {
    if (selectedEmailIds.length === 0) return;
    action(selectedEmailIds);
    exitSelection();
  }

  function assignSelectedCategory(categoryId: string) {
    if (selectedEmailIds.length === 0) return;
    onAssignCategory(selectedEmailIds, categoryId);
    exitSelection();
  }

  return (
    <section className="screen-section inbox-screen">
      {isSelectionMode ? (
        <header className="inbox-header inbox-selection-header">
          <IconButton label={language === "zh" ? "退出多选" : "Exit selection"} onClick={exitSelection}>
            <ArrowLeft size={28} />
          </IconButton>
          <span aria-label={selectedCountLabel} className="selection-count">{selectedEmailIds.length}</span>
          <div className="selection-action-group">
            <IconButton label={language === "zh" ? "归档" : "Archive"} onClick={() => runBulkAction(onArchiveEmails)}>
              <Archive size={25} />
            </IconButton>
            <IconButton label={language === "zh" ? "删除" : "Delete"} onClick={() => runBulkAction(onDeleteEmails)}>
              <Trash2 size={25} />
            </IconButton>
            <IconButton label={language === "zh" ? "一键已读" : "Mark read"} onClick={() => runBulkAction(onMarkReadEmails)}>
              <MailCheck size={25} />
            </IconButton>
            <IconButton label={language === "zh" ? "更多操作" : "More actions"} onClick={() => setLabelMenuOpen((open) => !open)}>
              <MoreHorizontal size={27} />
            </IconButton>
          </div>
        </header>
      ) : (
        <header className="inbox-header">
          <IconButton label={language === "zh" ? "菜单" : "Menu"} onClick={onOpenMenu}>
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
          <IconButton className="profile-button" label={language === "zh" ? "账户" : "Account"} onClick={() => setAccountMenuOpen((open) => !open)}>
            {session.picture ? <img alt="" src={session.picture} /> : <span>{accountInitial}</span>}
          </IconButton>
          <IconButton label={language === "zh" ? "分类规则设置" : "Sort rule settings"} onClick={onOpenSettings}>
            <SlidersHorizontal size={25} />
          </IconButton>
        </header>
      )}

      {labelMenuOpen ? (
        <div aria-label={language === "zh" ? "智能标签" : "Smart labels"} className="bulk-label-popover" role="dialog">
          <div className="bulk-label-head">
            <strong>{language === "zh" ? "智能标签" : "Smart labels"}</strong>
            <button onClick={onOpenSettings} type="button" aria-label={language === "zh" ? "创建智能标签" : "Create smart label"}>
              <Plus size={24} />
            </button>
          </div>
          <div className="bulk-label-list">
            {categories.map((category) => (
              <button key={category.id} onClick={() => assignSelectedCategory(category.id)} type="button">
                <span className="bulk-label-swatch" style={{ background: category.color }} />
                <span>{categoryLabel(category, language)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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

      {isSelectionMode ? (
        <div className="select-all-row">
          <button aria-pressed={allVisibleSelected} onClick={toggleSelectAll} type="button">
            <span className={`select-all-box ${allVisibleSelected ? "select-all-box-active" : ""}`}>
              {allVisibleSelected ? <Check size={19} strokeWidth={3} /> : null}
            </span>
            <span>{language === "zh" ? "全选" : "Select all"}</span>
          </button>
        </div>
      ) : showCategories ? (
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
              isSelected={selectedEmailIds.includes(email.id)}
              isSelectionMode={isSelectionMode}
              onLongPress={enterSelection}
              onOpen={onOpenEmail}
              onSelectionToggle={toggleSelected}
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
