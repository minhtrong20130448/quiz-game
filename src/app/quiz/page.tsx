"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { OptionButton, type OptionState } from "@/components/OptionButton";
import { ProtectedContent } from "@/components/ProtectedContent";
import { shuffle } from "@/lib/shuffle";
import type { WrongDetail } from "@/lib/types";

interface PlayQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

interface ShuffledOption {
  text: string;
  isCorrect: boolean;
}

interface ShuffledQuestion {
  id: string;
  question: string;
  source: string | null;
  options: ShuffledOption[];
}

type LoadState = "loading" | "ready" | "forbidden" | "error";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_FIELDS = ["option_a", "option_b", "option_c", "option_d"] as const;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

// Thứ tự câu hỏi giữ nguyên như server trả về (đã xáo trộn & lưu ở served_question_ids
// để reload giữa chừng vẫn ra đúng bộ câu) — chỉ xáo trộn thứ tự 4 đáp án mỗi câu.
function buildShuffledQuestions(questions: PlayQuestion[]): ShuffledQuestion[] {
  return questions.map((q) => {
    const options = shuffle(
      OPTION_KEYS.map((key, idx) => ({
        text: q[OPTION_FIELDS[idx]],
        isCorrect: key === q.answer,
      }))
    );
    return { id: q.id, question: q.question, source: q.source, options };
  });
}

export default function QuizPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrongDetails, setWrongDetails] = useState<WrongDetail[]>([]);
  const [username, setUsername] = useState("");
  const [memoCode, setMemoCode] = useState("");
  const orderIdRef = useRef("");
  const topicIdRef = useRef("");
  const topicNameRef = useRef("");
  const startedRef = useRef(false);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("quizUsername");
    const storedOrderId = sessionStorage.getItem("quizOrderId");
    if (!storedUsername || !storedOrderId) {
      router.replace("/");
      return;
    }
    // Gán lại vào const kiểu `string` (không `| null`) để dùng an toàn trong closure bên dưới.
    const safeUsername: string = storedUsername;
    const safeOrderId: string = storedOrderId;
    orderIdRef.current = safeOrderId;

    // React chạy effect 2 lần ở dev (StrictMode) — tránh gọi /api/play/start 2 lần.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function startPlay() {
      setUsername(safeUsername);
      setMemoCode(sessionStorage.getItem("quizMemoCode") ?? safeOrderId);

      try {
        const res = await fetch("/api/play/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: safeOrderId }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 403) {
          setErrorMessage(data.error ?? "Vé đã dùng hoặc không hợp lệ.");
          setLoadState("forbidden");
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Không tải được câu hỏi.");

        topicIdRef.current = data.topicId;
        topicNameRef.current = data.topicName;
        setQuestions(buildShuffledQuestions(data.questions));
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    startPlay();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleSelect(currentQuestion: ShuffledQuestion, index: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(index);

    const chosenOption = currentQuestion.options[index];
    if (chosenOption.isCorrect) {
      setScore((s) => s + 1);
      return;
    }

    const correctOption = currentQuestion.options.find((o) => o.isCorrect);
    setWrongDetails((list) => [
      ...list,
      {
        id: currentQuestion.id,
        question: currentQuestion.question,
        chosen: chosenOption.text,
        correct: correctOption?.text ?? "",
        source: currentQuestion.source,
      },
    ]);
  }

  function handleNext(isLastQuestion: boolean) {
    if (!isLastQuestion) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      return;
    }

    const result = {
      username,
      topic: topicNameRef.current,
      topicId: topicIdRef.current,
      orderId: orderIdRef.current,
      memoCode,
      score,
      correct_count: score,
      wrong_count: wrongDetails.length,
      total_questions: questions.length,
      wrong_details: wrongDetails,
    };
    sessionStorage.setItem("quizResult", JSON.stringify(result));
    router.push("/result");
  }

  if (loadState === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-text-muted">Đang tải câu hỏi, chờ xíu nha...</p>
      </main>
    );
  }

  if (loadState === "forbidden" || loadState === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Card className="w-full">
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {loadState === "forbidden"
              ? errorMessage
              : "Tải câu hỏi bị lỗi rồi, thử lại nha!"}
          </p>
          <Button variant="ghost" className="mt-4 w-full" onClick={() => router.push("/")}>
            Quay về trang chủ
          </Button>
        </Card>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const isLastQuestion = currentIndex === questions.length - 1;
  const hasAnswered = selectedIndex !== null;

  return (
    <ProtectedContent username={username} code={memoCode}>
      <main className="flex flex-1 flex-col gap-4 py-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-text-muted">
            Câu {currentIndex + 1}/{questions.length}
          </span>
          <span className="font-semibold text-accent">Điểm: {score}</span>
        </div>

        <ProgressBar value={currentIndex + 1} max={questions.length} />

        <Card>
          <p className="text-lg font-semibold text-text">{currentQuestion.question}</p>
        </Card>

        <div className="flex flex-col gap-3">
          {currentQuestion.options.map((option, idx) => {
            let state: OptionState = "idle";
            if (hasAnswered) {
              if (option.isCorrect) state = "correct";
              else if (idx === selectedIndex) state = "wrong";
              else state = "muted";
            }

            return (
              <OptionButton
                key={idx}
                label={OPTION_LABELS[idx]}
                text={option.text}
                state={state}
                disabled={hasAnswered}
                onClick={() => handleSelect(currentQuestion, idx)}
              />
            );
          })}
        </div>

        {hasAnswered && (
          <Button className="w-full" onClick={() => handleNext(isLastQuestion)}>
            {isLastQuestion ? "Xem kết quả" : "Câu tiếp theo"}
          </Button>
        )}
      </main>
    </ProtectedContent>
  );
}
