"use client";

import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";

interface TopPlayersPodiumProps {
  /** Chỉ tính điểm của 1 chủ đề. Bỏ trống hoặc "ALL" = xếp hạng chung mọi chủ đề. */
  topic?: string;
  title?: string;
}

type LoadState = "loading" | "ready" | "error";

// Thứ tự hiển thị vật lý trên bục: hạng 2 (trái) — hạng 1 (giữa, cao nhất) — hạng 3 (phải).
const RANK_STYLES = [
  { badge: "bg-accent text-white", pad: "pt-10 pb-6", position: "order-2" },
  { badge: "bg-slate-400 text-white", pad: "pt-6 pb-6", position: "order-1" },
  { badge: "bg-amber-700 text-white", pad: "pt-4 pb-6", position: "order-3" },
];

const PENTAGON_CLIP = "[clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]";

export function TopPlayersPodium({ topic, title = "Top 3 cao thủ 🔥" }: TopPlayersPodiumProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadTop3() {
      try {
        const params = new URLSearchParams({ unique: "1", limit: "3" });
        if (topic && topic !== "ALL") params.set("topic", topic);
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (!res.ok) throw new Error("failed to load leaderboard");
        const data: LeaderboardEntry[] = await res.json();
        if (cancelled) return;
        setEntries(data);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    loadTop3();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  if (loadState !== "ready" || entries.length === 0) return null;

  return (
    <div className="w-full">
      <h2 className="mb-4 text-center text-lg font-semibold text-text">{title}</h2>
      <div className="flex items-end justify-center gap-3">
        {entries.map((entry, idx) => {
          const style = RANK_STYLES[idx];
          return (
            <div key={entry.username} className={`flex w-28 flex-col items-center gap-2 ${style.position}`}>
              <p className="max-w-full truncate text-sm font-semibold text-text" title={entry.username}>
                {entry.username}
              </p>
              <div
                className={`flex w-full flex-col items-center rounded-2xl border-2 border-slate-100 bg-surface shadow-lg ${style.pad}`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center text-lg font-bold ${style.badge} ${PENTAGON_CLIP}`}
                >
                  {idx + 1}
                </div>
                <p className="mt-3 text-2xl font-bold text-text">{entry.score}</p>
                <p className="text-xs text-text-muted">
                  {entry.correct_count}/{entry.total_questions} câu
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
