export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-linear-to-r from-primary to-secondary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
