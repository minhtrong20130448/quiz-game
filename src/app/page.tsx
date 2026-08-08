"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { TopicCount } from "@/lib/types";

const MAX_USERNAME_LENGTH = 30;
const ALL_TOPIC_VALUE = "ALL";

type LoadState = "loading" | "ready" | "error";

export default function HomePage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [username, setUsername] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(ALL_TOPIC_VALUE);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTopics() {
      try {
        const res = await fetch("/api/topics");
        if (!res.ok) throw new Error("Không tải được danh sách chủ đề");
        const data: TopicCount[] = await res.json();
        if (cancelled) return;
        setTopics(data);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    loadTopics();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalQuestions = topics.reduce((sum, t) => sum + t.count, 0);
  const hasQuestions = totalQuestions > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = username.trim();

    if (!trimmedName) {
      setFormError("Vui lòng nhập tên của bạn.");
      return;
    }

    setFormError(null);
    sessionStorage.setItem("quizUsername", trimmedName);
    sessionStorage.setItem("quizTopic", selectedTopic);
    router.push("/quiz");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="bg-linear-to-r from-primary to-secondary bg-clip-text text-4xl font-bold text-transparent">
          Quiz trắc nghiệm
        </h1>
        <p className="mt-2 text-text-muted">Nhập tên, chọn chủ đề và bắt đầu thử sức!</p>
      </div>

      <Card className="w-full">
        {loadState === "error" ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-medium text-danger">
            Không tải được danh sách chủ đề. Vui lòng thử tải lại trang.
          </p>
        ) : loadState === "ready" && !hasQuestions ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-medium text-danger">
            Chưa có câu hỏi — vui lòng liên hệ admin import dữ liệu.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-medium text-text">
                Tên của bạn
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={MAX_USERNAME_LENGTH}
                placeholder="VD: Minh"
                disabled={loadState === "loading"}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-slate-100"
              />
              {formError && <p className="text-sm text-danger">{formError}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="topic" className="text-sm font-medium text-text">
                Chọn chủ đề
              </label>
              <select
                id="topic"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={loadState === "loading"}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-slate-100"
              >
                <option value={ALL_TOPIC_VALUE}>Tất cả ({totalQuestions} câu)</option>
                {topics.map((t) => (
                  <option key={t.topic} value={t.topic}>
                    {t.topic} ({t.count} câu)
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={loadState === "loading"} className="w-full">
              {loadState === "loading" ? "Đang tải..." : "Bắt đầu"}
            </Button>
          </form>
        )}
      </Card>

      <Link href="/leaderboard" className="text-sm font-medium text-primary hover:underline">
        Xem bảng xếp hạng →
      </Link>
    </main>
  );
}
