import { PenLine } from "lucide-react";
import type { ReactNode } from "react";
import type { Language, Screen } from "../types";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  activeScreen: Screen;
  activeTodoCount: number;
  inboxCount: number;
  children: ReactNode;
  hideNavigation?: boolean;
  language: Language;
  onCompose: () => void;
  onNavigate: (screen: Screen) => void;
}

export function AppShell({
  activeScreen,
  activeTodoCount,
  inboxCount,
  children,
  hideNavigation,
  language,
  onCompose,
  onNavigate
}: AppShellProps) {
  return (
    <div className="phone-stage">
      <div className="phone-shell">
        <div className="screen-scroll">{children}</div>
        {!hideNavigation ? (
          <div className="bottom-dock">
            <BottomNav
              activeScreen={activeScreen}
              activeTodoCount={activeTodoCount}
              inboxCount={inboxCount}
              language={language}
              onNavigate={onNavigate}
            />
            <button className="compose-fab" onClick={onCompose} type="button" aria-label="写邮件">
              <PenLine size={31} strokeWidth={2.45} />
              <SparkleDot />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SparkleDot() {
  return <span className="compose-sparkle">✦</span>;
}
