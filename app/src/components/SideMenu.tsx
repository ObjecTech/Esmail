import {
  Archive,
  Clock,
  FileText,
  Hexagon,
  Inbox,
  Languages,
  Palette,
  Send,
  ShieldAlert,
  Plus,
  Star,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { categoryLabel, text } from "../language";
import type { MailboxCounts } from "../mailboxCounts";
import type { Category, Language, MailboxView, Theme } from "../types";

interface SideMenuProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  inboxCount: number;
  isOpen: boolean;
  language: Language;
  mailboxCounts: MailboxCounts;
  mailboxView: MailboxView;
  theme: Theme;
  onCategorySelect: (categoryId: string) => void;
  onClose: () => void;
  onMailboxSelect: (view: MailboxView) => void;
  onOpenSettings: () => void;
  onOpenSmartLabel: () => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
}

export function SideMenu({
  categories,
  categoryCounts,
  inboxCount,
  isOpen,
  language,
  mailboxCounts,
  mailboxView,
  theme,
  onCategorySelect,
  onClose,
  onMailboxSelect,
  onOpenSettings,
  onOpenSmartLabel,
  onToggleLanguage,
  onToggleTheme
}: SideMenuProps) {
  const folderRows: Array<{ view: MailboxView; label: string; icon: typeof Archive; count?: string | number }> = [
    { view: "all", label: text(language, "allMail"), icon: Archive, count: mailboxCounts.all },
    { view: "starred", label: text(language, "starred"), icon: Star, count: mailboxCounts.starred },
    { view: "snoozed", label: language === "zh" ? "已延后" : "Snoozed", icon: Clock, count: mailboxCounts.snoozed },
    { view: "drafts", label: text(language, "drafts"), icon: FileText, count: mailboxCounts.drafts },
    { view: "sent", label: language === "zh" ? "已发送" : "Sent", icon: Send, count: mailboxCounts.sent },
    { view: "archive", label: language === "zh" ? "归档" : "Archive", icon: Archive, count: mailboxCounts.archive },
    { view: "spam", label: language === "zh" ? "垃圾邮件" : "Spam", icon: ShieldAlert, count: mailboxCounts.spam },
    { view: "trash", label: language === "zh" ? "回收站" : "Trash", icon: Trash2, count: mailboxCounts.trash }
  ];
  const themeLabels: Record<Theme, string> = {
    classic: language === "zh" ? "经典深蓝" : "Classic",
    white: language === "zh" ? "白色" : "White"
  };

  return (
    <div className={`menu-layer ${isOpen ? "menu-layer-open" : ""}`} aria-hidden={!isOpen}>
      <button className="menu-scrim" onClick={onClose} type="button" aria-label="关闭菜单" />
      <aside className="side-menu" aria-label="邮箱菜单">
        <header className="side-menu-header">
          <h2>{text(language, "esmailMail")}</h2>
          <div className="side-menu-actions">
            <button type="button" aria-label="关闭" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </header>

        <button
          className="menu-primary-row"
          onClick={() => {
            onMailboxSelect("all");
            onClose();
          }}
          type="button"
        >
          <Inbox size={27} />
          <span>{text(language, "allInbox")}</span>
          <strong>{inboxCount}</strong>
        </button>

        <div className="menu-section">
          {categories.map((category) => (
            <button
              className="menu-row"
              key={category.id}
              onClick={() => {
                onCategorySelect(category.id);
                onMailboxSelect("inbox");
                onClose();
              }}
              type="button"
            >
              <Tag size={27} style={{ color: category.color }} />
              <span>{categoryLabel(category, language)}</span>
              <strong>{categoryCounts[category.id] || ""}</strong>
            </button>
          ))}
          <button
            className="menu-row muted-menu-row"
            onClick={() => {
              onOpenSmartLabel();
              onClose();
            }}
            type="button"
          >
            <Plus size={27} />
            <span>{language === "zh" ? "创建智能标签" : "Create Smart Label"}</span>
          </button>
        </div>

        <div className="menu-divider" />

        <div className="menu-section">
          {folderRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                className={`menu-row ${mailboxView === row.view ? "menu-row-active" : ""}`}
                key={row.view}
                onClick={() => {
                  onMailboxSelect(row.view);
                  onClose();
                }}
                type="button"
              >
                <Icon size={25} />
                <span>{row.label}</span>
                <strong>{row.count || ""}</strong>
              </button>
            );
          })}
          <button
            className="menu-row"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            type="button"
          >
            <Hexagon size={25} />
            <span>{text(language, "customView")}</span>
          </button>
          <button className="menu-row" onClick={onToggleLanguage} type="button">
            <Languages size={25} />
            <span>{text(language, "language")}</span>
            <strong>{language === "zh" ? "中文" : "EN"}</strong>
          </button>
          <button className="menu-row" onClick={onToggleTheme} type="button">
            <Palette size={25} />
            <span>{language === "zh" ? "主题" : "Theme"}</span>
            <strong>{themeLabels[theme]}</strong>
          </button>
        </div>
      </aside>
    </div>
  );
}
