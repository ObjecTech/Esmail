import { Check } from "lucide-react";

interface TodoCheckProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
}

export function TodoCheck({ checked, label, onToggle }: TodoCheckProps) {
  return (
    <button
      aria-label={checked ? `已完成 ${label}` : `完成 ${label}`}
      className={`todo-check ${checked ? "todo-check-complete" : ""}`}
      onClick={onToggle}
      type="button"
    >
      {checked ? <Check size={15} strokeWidth={3} /> : null}
    </button>
  );
}
