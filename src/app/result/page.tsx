"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ProtectedContent } from "@/components/ProtectedContent";
import { TopPlayersPodium } from "@/components/TopPlayersPodium";
import type { QuizResult } from "@/lib/types";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const hasSavedRef = useRef(false);

  useEffect(() => {
    function loadResult() {
      const raw = sessionStorage.getItem("quizResult");
      if (!raw) {
        setLoadState("missing");
        return;
      }

      let parsed: QuizResult;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setLoadState("missing");
        return;
      }

      setResult(parsed);
      setLoadState("ready");

      if (!hasSavedRef.current) {
        hasSavedRef.current = true;
        fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        }).catch(() => {
          // Lưu điểm thất bại không nên chặn người chơi xem lại kết quả của mình.
        });
      }
    }

    loadResult();
  }, []);

  if (loadState === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-text-muted">Đang tải kết quả...</p>
      </main>
    );
  }

  if (loadState === "missing" || !result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Card className="w-full">
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            Ơ, không thấy kết quả đâu cả 🤔 Chơi lại từ đầu nha!
          </p>
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => router.push("/")}
          >
            Về trang chủ
          </Button>
        </Card>
      </main>
    );
  }

  const accuracy =
    result.total_questions > 0
      ? Math.round((result.correct_count / result.total_questions) * 100)
      : 0;

  return (
    <ProtectedContent username={result.username} code={result.memoCode || result.orderId}>
      <main className="flex flex-1 flex-col gap-5 py-4">
        <Card className="text-center">
          <p className="text-text-muted">
            {result.username} · Chủ đề:{" "}
            <span className="font-medium text-text">{result.topic}</span>
          </p>
          <p className="mt-3 text-5xl font-bold text-accent">{result.score}</p>
          <p className="text-sm text-text-muted">điểm</p>

          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-success/10 px-2 py-3">
              <p className="text-lg font-semibold text-success">
                {result.correct_count}
              </p>
              <p className="text-text-muted">Câu đúng</p>
            </div>
            <div className="rounded-xl bg-danger/10 px-2 py-3">
              <p className="text-lg font-semibold text-danger">
                {result.wrong_count}
              </p>
              <p className="text-text-muted">Câu sai</p>
            </div>
            <div className="rounded-xl bg-primary/10 px-2 py-3">
              <p className="text-lg font-semibold text-primary">{accuracy}%</p>
              <p className="text-text-muted">Chính xác</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {result.correct_count}/{result.total_questions} câu
          </p>
        </Card>

        <TopPlayersPodium topic={result.topic} title="Xếp hạng chủ đề này 🔥" />

        <div>
          <h2 className="mb-3 text-lg font-semibold text-text">
            Xem lại câu đã sai
          </h2>

          {result.wrong_details.length === 0 ? (
            <Card>
              <p className="text-center text-success">
                🎉 Đỉnh của chóp! Đúng hết trơn luôn á!
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {result.wrong_details.map((item, idx) => (
                <Card key={item.id ?? idx}>
                  <p className="font-medium text-text">{item.question}</p>
                  <p className="mt-2 text-sm text-danger">
                    Bạn chọn: {item.chosen}
                  </p>
                  <p className="text-sm text-success">
                    Đáp án đúng: {item.correct}
                  </p>
                  {item.source && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted">
                      Trích đáp án gốc: {item.source}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <Link href="/">
          <Button variant="secondary" className="w-full">
            Chơi lại
          </Button>
        </Link>
      </main>
    </ProtectedContent>
  );
}
