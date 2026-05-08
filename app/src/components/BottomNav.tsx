import { CheckSquare, Inbox, Sparkles } from "lucide-react";
import { text } from "../language";
import type { Language, Screen } from "../types";

interface BottomNavProps {
  activeScreen: Screen;
  activeTodoCount: number;
  inboxCount: number;
  language: Language;
  onNavigate: (screen: Screen) => void;
}

const navItems: Array<{
  id: Screen;
  labelKey: "inbox" | "todos";
  icon: typeof Inbox;
}> = [
  { id: "inbox", labelKey: "inbox", icon: Inbox },
  { id: "todos", labelKey: "todos", icon: CheckSquare },
  { id: "ai", labelKey: "inbox", icon: Sparkles }
];

export function BottomNav({ activeScreen, activeTodoCount, inboxCount, language, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label={language === "zh" ? "主要导航" : "Primary navigation"}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeScreen === item.id;
        const badgeCount = item.id === "inbox" ? inboxCount : item.id === "todos" ? activeTodoCount : 0;

        return (
          <button
            className={`bottom-nav-item ${isActive ? "bottom-nav-item-active" : ""}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span className="bottom-nav-icon-wrap">
              <Icon size={25} strokeWidth={2.4} />
              {badgeCount > 0 ? <span className="nav-badge">{badgeCount}</span> : null}
            </span>
            <span>{item.id === "ai" ? "AI" : text(language, item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
