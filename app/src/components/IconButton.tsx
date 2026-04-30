import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  label: string;
  active?: boolean;
}

export function IconButton({ children, label, active, className = "", ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${active ? "icon-button-active" : ""} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
