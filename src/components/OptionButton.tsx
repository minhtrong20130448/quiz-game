import type { ButtonHTMLAttributes } from "react";

export type OptionState = "idle" | "correct" | "wrong" | "muted";

interface OptionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  text: string;
  state: OptionState;
}

const stateClasses: Record<OptionState, string> = {
  idle: "border-slate-200 bg-white hover:border-primary hover:bg-primary/5",
  correct: "border-success bg-success/10 text-success",
  wrong: "border-danger bg-danger/10 text-danger",
  muted: "border-slate-200 bg-white opacity-60",
};

const badgeClasses: Record<OptionState, string> = {
  idle: "bg-slate-100 text-text-muted",
  correct: "bg-success text-white",
  wrong: "bg-danger text-white",
  muted: "bg-slate-100 text-text-muted",
};

export function OptionButton({ label, text, state, className = "", ...props }: OptionButtonProps) {
  return (
    <button
      type="button"
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors duration-200 disabled:cursor-not-allowed ${stateClasses[state]} ${className}`}
      {...props}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${badgeClasses[state]}`}
      >
        {label}
      </span>
      <span className="flex-1">{text}</span>
    </button>
  );
}
