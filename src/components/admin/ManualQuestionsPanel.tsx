"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

interface SubjectOption {
  id: string;
  name: string;
}

interface TopicOption {
  id: string;
  subjectId: string;
  name: string;
}

interface QuestionListItem {
  id: string;
  question: string;
  answer: string;
}

interface QuestionDetail {
  id: string;
  topic_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

interface QuestionForm {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string;
}

type ListLoadState = "idle" | "loading" | "ready" | "error";
type DetailMode = { type: "new" } | { type: "edit"; id: string } | null;
type SaveState = "idle" | "saving" | "error";

const EMPTY_FORM: QuestionForm = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  answer: "A",
  source: "",
};

const OPTION_FIELDS = ["option_a", "option_b", "option_c", "option_d"] as const;
const OPTION_LABELS = ["A", "B", "C", "D"] as const;

interface ManualQuestionsPanelProps {
  password: string;
  /** Gọi sau khi thêm/xoá câu hỏi thành công (không gọi khi chỉ sửa) — để nơi dùng
   * component này có thể làm mới số liệu tổng hợp (VD: "Số câu hiện có"). */
  onQuestionCountChanged?: () => void;
}

export function ManualQuestionsPanel({ password, onQuestionCountChanged }: ManualQuestionsPanelProps) {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [listState, setListState] = useState<ListLoadState>("idle");

  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadOptions() {
    try {
      const [subjectsRes, topicsRes] = await Promise.all([
        fetch("/api/admin/subjects", { headers: { "x-admin-password": password } }),
        fetch("/api/admin/topics", { headers: { "x-admin-password": password } }),
      ]);
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (topicsRes.ok) setTopics(await topicsRes.json());
    } catch {
      // Chọn môn/chủ đề không tải được thì phần dưới coi như chưa chọn được gì — bỏ qua.
    }
  }

  useEffect(() => {
    // `loadOptions` chỉ setState sau khi `await fetch(...)` xong (không đồng bộ) — an
    // toàn để gọi khi mount, nhưng lint không lần theo được thân hàm khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions(topicId: string) {
    setListState("loading");
    setDetailMode(null);
    try {
      const res = await fetch(`/api/admin/questions?topic_id=${topicId}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("failed");
      const data: QuestionListItem[] = await res.json();
      setQuestions(data);
      setListState("ready");
    } catch {
      setListState("error");
    }
  }

  function handleSelectSubject(subjectId: string) {
    setSelectedSubjectId(subjectId);
    setSelectedTopicId("");
    setQuestions([]);
    setListState("idle");
    setDetailMode(null);
  }

  function handleSelectTopic(topicId: string) {
    setSelectedTopicId(topicId);
    if (topicId) {
      loadQuestions(topicId);
    } else {
      setQuestions([]);
      setListState("idle");
      setDetailMode(null);
    }
  }

  function openNewForm() {
    setForm(EMPTY_FORM);
    setSaveError("");
    setDetailMode({ type: "new" });
  }

  async function openEditForm(id: string) {
    setDetailMode({ type: "edit", id });
    setDetailLoading(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { headers: { "x-admin-password": password } });
      if (!res.ok) throw new Error("failed");
      const data: QuestionDetail = await res.json();
      setForm({
        question: data.question,
        option_a: data.option_a,
        option_b: data.option_b,
        option_c: data.option_c,
        option_d: data.option_d,
        answer: data.answer,
        source: data.source ?? "",
      });
    } catch {
      setSaveError("Không tải được chi tiết câu hỏi.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailMode) return;

    const trimmedQuestion = form.question.trim();
    const a = form.option_a.trim();
    const b = form.option_b.trim();
    const c = form.option_c.trim();
    const d = form.option_d.trim();
    if (!trimmedQuestion || !a || !b || !c || !d) {
      setSaveError("Điền đủ câu hỏi và 4 phương án.");
      return;
    }

    setSaveState("saving");
    setSaveError("");
    try {
      const payload = {
        question: trimmedQuestion,
        option_a: a,
        option_b: b,
        option_c: c,
        option_d: d,
        answer: form.answer,
        source: form.source.trim() || null,
      };

      const res =
        detailMode.type === "new"
          ? await fetch("/api/admin/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-admin-password": password },
              body: JSON.stringify({ ...payload, topicId: selectedTopicId }),
            })
          : await fetch(`/api/admin/questions/${detailMode.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", "x-admin-password": password },
              body: JSON.stringify(payload),
            });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được câu hỏi.");

      setSaveState("idle");
      setDetailMode(null);
      await loadQuestions(selectedTopicId);
      if (detailMode.type === "new") onQuestionCountChanged?.();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Không lưu được câu hỏi.");
    }
  }

  async function handleDelete() {
    if (!detailMode || detailMode.type !== "edit") return;
    const confirmed = window.confirm("Xoá câu hỏi này? Không thể hoàn tác.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/questions/${detailMode.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("failed");
      setDetailMode(null);
      await loadQuestions(selectedTopicId);
      onQuestionCountChanged?.();
    } catch {
      setSaveError("Không xoá được câu hỏi.");
    } finally {
      setDeleting(false);
    }
  }

  const topicOptions = selectedSubjectId ? topics.filter((t) => t.subjectId === selectedSubjectId) : [];

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-xl">
      <h2 className="mb-3 text-lg font-semibold text-text">Thêm / sửa câu hỏi thủ công</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={selectedSubjectId}
          onChange={(e) => handleSelectSubject(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Chọn môn học</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedTopicId}
          onChange={(e) => handleSelectTopic(e.target.value)}
          disabled={!selectedSubjectId}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-slate-100"
        >
          <option value="">Chọn chủ đề</option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedTopicId ? (
        <p className="text-sm text-text-muted">Chọn môn rồi chọn chủ đề để xem danh sách câu hỏi.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {listState === "loading" ? (
              <p className="text-sm text-text-muted">Đang tải...</p>
            ) : listState === "error" ? (
              <p className="text-sm text-danger">Không tải được danh sách câu hỏi.</p>
            ) : (
              <>
                <Button variant="secondary" className="mb-3 w-full" onClick={openNewForm}>
                  + Thêm câu hỏi mới
                </Button>
                {questions.length === 0 ? (
                  <p className="text-sm text-text-muted">Chủ đề này chưa có câu hỏi nào.</p>
                ) : (
                  <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                    {questions.map((q, i) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => openEditForm(q.id)}
                          className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                            detailMode?.type === "edit" && detailMode.id === q.id
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-text hover:bg-slate-50"
                          }`}
                        >
                          {i + 1}. {q.question}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            {!detailMode ? (
              <p className="text-sm text-text-muted">Chọn 1 câu ở danh sách bên trái để sửa, hoặc thêm câu mới.</p>
            ) : detailLoading ? (
              <p className="text-sm text-text-muted">Đang tải chi tiết...</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <textarea
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="Nội dung câu hỏi"
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />

                {OPTION_FIELDS.map((field, idx) => (
                  <div key={field} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="manual-answer"
                      checked={form.answer === OPTION_LABELS[idx]}
                      onChange={() => setForm((f) => ({ ...f, answer: OPTION_LABELS[idx] }))}
                    />
                    <input
                      value={form[field]}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder={`Phương án ${OPTION_LABELS[idx]}`}
                      className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
                <p className="text-xs text-text-muted">Chọn nút tròn cạnh phương án đúng.</p>

                <textarea
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  placeholder="Nguồn / giải thích (tuỳ chọn)"
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />

                {saveError && <p className="text-sm text-danger">{saveError}</p>}

                <div className="flex gap-2">
                  <Button type="submit" disabled={saveState === "saving"}>
                    {saveState === "saving" ? "Đang lưu..." : "Lưu"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDetailMode(null)}>
                    Huỷ
                  </Button>
                  {detailMode.type === "edit" && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="ml-auto text-danger hover:bg-danger/10"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Đang xoá..." : "Xoá"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
