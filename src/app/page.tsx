"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Subject, Topic } from "@/lib/types";

const MAX_USERNAME_LENGTH = 30;

type SubjectsLoadState = "loading" | "ready" | "error";
type TopicsLoadState = "idle" | "loading" | "ready" | "error";

function formatPrice(price: number | null): string {
  if (price === null) return "Sắp có";
  if (price === 0) return "Miễn phí";
  return `${price.toLocaleString("vi-VN")}đ`;
}

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsState, setSubjectsState] = useState<SubjectsLoadState>("loading");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsState, setTopicsState] = useState<TopicsLoadState>("idle");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubjects() {
      try {
        const res = await fetch("/api/subjects");
        if (!res.ok) throw new Error("Không tải được danh sách môn học");
        const data: Subject[] = await res.json();
        if (cancelled) return;
        setSubjects(data);
        setSubjectsState("ready");
      } catch {
        if (!cancelled) setSubjectsState("error");
      }
    }

    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;

    let cancelled = false;

    async function loadTopics() {
      try {
        const res = await fetch(`/api/topics?subject_id=${selectedSubjectId}`);
        if (!res.ok) throw new Error("Không tải được danh sách chủ đề");
        const data: Topic[] = await res.json();
        if (cancelled) return;
        setTopics(data);
        setTopicsState("ready");
      } catch {
        if (!cancelled) setTopicsState("error");
      }
    }

    loadTopics();
    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const isLoadingSubjects = subjectsState === "loading";

  function handleSelectSubject(subjectId: string) {
    if (subjectId === selectedSubjectId) return;
    setSelectedSubjectId(subjectId);
    setSelectedTopicId(null);
    setTopics([]);
    setTopicsState("loading");
    setFormError(null);
  }

  function handleSelectTopic(topic: Topic) {
    if (!topic.sellable) return;
    setSelectedTopicId(topic.id);
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = username.trim();

    if (!trimmedName) {
      setFormError("Bạn quên nhập tên rồi kìa!");
      return;
    }
    if (!selectedSubjectId) {
      setFormError("Chọn một môn học đã nha!");
      return;
    }
    if (!selectedTopic || !selectedTopic.sellable) {
      setFormError("Chọn một chủ đề đang mở bán đã nha!");
      return;
    }

    setFormError(null);
    sessionStorage.setItem("quizUsername", trimmedName);
    sessionStorage.setItem("quizSubjectId", selectedSubjectId);
    sessionStorage.setItem("quizTopicId", selectedTopic.id);
    // Chủ đề miễn phí (price=0) hay có phí đều đi qua /pay: trang đó tự bỏ qua
    // bước chờ QR khi đơn 0đ và cho vào chơi ngay (xem Step 4).
    router.push("/pay");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="bg-linear-to-r from-primary to-secondary bg-clip-text text-4xl font-bold text-transparent">
          Quiz trắc nghiệm
        </h1>
        <p className="mt-2 text-text-muted">
          Điền tên, chọn môn rồi chọn chủ đề để vào chơi!
        </p>
      </div>

      <Card className="w-full">
        {subjectsState === "error" ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-medium text-danger">
            Ơ, tải môn học bị lỗi rồi 😅 Thử tải lại trang xem sao nha!
          </p>
        ) : subjectsState === "ready" && subjects.length === 0 ? (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-medium text-danger">
            Chưa có môn học nào mở bán hết trơn 😅 Nhắn admin nha!
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
                disabled={isLoadingSubjects}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-slate-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">Chọn môn học</span>
              {isLoadingSubjects ? (
                <p className="text-sm text-text-muted">Đang tải...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSubject(s.id)}
                      className={`min-h-11 rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                        selectedSubjectId === s.id
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-slate-200 text-text hover:border-primary/50"
                      }`}
                    >
                      {s.name}
                      <span className="ml-2 text-sm font-normal text-text-muted">
                        ({s.topicCount} chủ đề)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSubjectId && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text">Chọn chủ đề</span>
                {topicsState === "loading" ? (
                  <p className="text-sm text-text-muted">Đang tải...</p>
                ) : topicsState === "error" ? (
                  <p className="text-sm text-danger">Không tải được chủ đề, thử lại nha!</p>
                ) : topics.length === 0 ? (
                  <p className="text-sm text-text-muted">Môn này chưa có chủ đề nào.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTopic(t)}
                        disabled={!t.sellable}
                        className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectedTopicId === t.id
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-slate-200 text-text hover:border-primary/50"
                        }`}
                      >
                        <span>
                          {t.name}
                          <span className="ml-2 text-sm font-normal text-text-muted">
                            ({t.questionCount} câu)
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-sm font-semibold ${
                            !t.sellable
                              ? "text-text-muted"
                              : t.price === 0
                                ? "text-secondary"
                                : "text-primary"
                          }`}
                        >
                          {formatPrice(t.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <Button type="submit" disabled={isLoadingSubjects} className="w-full">
              {selectedTopic?.price === 0 ? "Chơi miễn phí ngay!" : "Tiếp tục thanh toán"}
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
