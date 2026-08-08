import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface p-6 shadow-xl sm:p-8 ${className}`}>{children}</div>;
}
