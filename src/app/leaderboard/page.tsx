"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import type { LeaderboardEntry, TopicCount } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const ALL_TOPIC_VALUE = "ALL";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [selectedTopic, setSelectedTopic] = useState(ALL_TOPIC_VALUE);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    fetch("/api/topics")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TopicCount[]) => setTopics(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoadState("loading");
      try {
        const params = new URLSearchParams({ unique: "1" });
        if (selectedTopic !== ALL_TOPIC_VALUE) params.set("topic", selectedTopic);
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (!res.ok) throw new Error("failed to load leaderboard");
        const data: LeaderboardEntry[] = await res.json();
        if (cancelled) return;
        setRows(data);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  return (
    <main className="flex flex-1 flex-col gap-5 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Bảng xếp hạng</h1>
        <Link href="/">
          <Button variant="ghost">Về trang chủ</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="topic-filter" className="text-sm font-medium text-text">
          Lọc theo chủ đề
        </label>
        <select
          id="topic-filter"
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value={ALL_TOPIC_VALUE}>Tất cả</option>
          {topics.map((t) => (
            <option key={t.topic} value={t.topic}>
              {t.topic}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-xl">
        {loadState === "loading" ? (
          <p className="p-6 text-center text-text-muted">Đang tải...</p>
        ) : loadState === "error" ? (
          <p className="p-6 text-center text-danger">Không tải được bảng xếp hạng.</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-text-muted">Chưa có lượt chơi nào.</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-primary/5 text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Hạng</th>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Chủ đề</th>
                <th className="px-4 py-3 font-medium">Điểm</th>
                <th className="px-4 py-3 font-medium">Đúng/Tổng</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.username}-${row.created_at}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-primary">{idx + 1}</td>
                  <td className="px-4 py-3">{row.username}</td>
                  <td className="px-4 py-3">{row.topic === "ALL" ? "Tất cả" : row.topic}</td>
                  <td className="px-4 py-3 font-semibold text-accent">{row.score}</td>
                  <td className="px-4 py-3">
                    {row.correct_count}/{row.total_questions}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
