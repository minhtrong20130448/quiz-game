"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/Button";
import { ManualQuestionsPanel } from "@/components/admin/ManualQuestionsPanel";
import { downloadTemplate, parseQuestionsSheet, validateImportRow, type ValidImportRow } from "@/lib/excelQuestions";

interface SubjectSummary {
  id: string;
  name: string;
}

interface TopicSummary {
  id: string;
  subjectId: string;
  name: string;
  questionCount: number;
}

type ImportMode = "replace" | "append";
type SummaryLoadState = "loading" | "ready" | "error";
type ImportState = "idle" | "importing" | "done" | "error";

interface ImportResult {
  insertedQuestions: number;
  createdSubjects: number;
  createdTopics: number;
  skipped: number;
}

export function QuestionsPanel({ password }: { password: string }) {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [summaryState, setSummaryState] = useState<SummaryLoadState>("loading");

  const [previewRows, setPreviewRows] = useState<ValidImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("append");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importState, setImportState] = useState<ImportState>("idle");
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadSummary() {
    try {
      const [subjectsRes, topicsRes] = await Promise.all([
        fetch("/api/admin/subjects", { headers: { "x-admin-password": password } }),
        fetch("/api/admin/topics", { headers: { "x-admin-password": password } }),
      ]);
      if (!subjectsRes.ok || !topicsRes.ok) throw new Error("failed to load summary");
      const subjectsData: SubjectSummary[] = await subjectsRes.json();
      const topicsData: TopicSummary[] = await topicsRes.json();
      setSubjects(subjectsData);
      setTopics(topicsData);
      setSummaryState("ready");
    } catch {
      setSummaryState("error");
    }
  }

  useEffect(() => {
    // `loadSummary` chỉ setState sau khi `await fetch(...)` xong (không đồng bộ) — an
    // toàn để gọi khi mount, nhưng lint không lần theo được thân hàm khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);
    setImportState("idle");
    setPreviewRows([]);
    setImportErrors([]);

    try {
      const rawRows = await parseQuestionsSheet(file);
      const valid: ValidImportRow[] = [];
      const errors: string[] = [];
      rawRows.forEach((row, index) => {
        const result = validateImportRow(row, index);
        if ("error" in result) errors.push(result.error);
        else valid.push(result.data);
      });
      setPreviewRows(valid);
      setImportErrors(errors);
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : "Không đọc được file."]);
    }
  }

  async function handleConfirmImport() {
    if (previewRows.length === 0) return;

    setImportState("importing");
    try {
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ mode, rows: previewRows }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImportState("error");
        setImportErrors((prev) => [...prev, data.error ?? "Import thất bại."]);
        return;
      }

      setImportResult({
        insertedQuestions: data.insertedQuestions,
        createdSubjects: data.createdSubjects,
        createdTopics: data.createdTopics,
        skipped: data.skipped,
      });
      setImportState("done");
      setPreviewRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadSummary();
    } catch {
      setImportState("error");
      setImportErrors((prev) => [...prev, "Không kết nối được tới server."]);
    }
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm("Xoá TOÀN BỘ ngân hàng câu hỏi? Hành động này không thể hoàn tác.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      if (res.ok) await loadSummary();
    } finally {
      setDeleting(false);
    }
  }

  const totalQuestions = topics.reduce((sum, t) => sum + t.questionCount, 0);
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-surface p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-text">Số câu hiện có</h2>

        {summaryState === "loading" ? (
          <p className="text-text-muted">Đang tải...</p>
        ) : summaryState === "error" ? (
          <p className="text-danger">Không tải được.</p>
        ) : topics.length === 0 ? (
          <p className="text-text-muted">Chưa có câu hỏi nào trong ngân hàng.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
              Tổng: {totalQuestions} câu
            </li>
            {topics
              .filter((t) => t.questionCount > 0)
              .map((t) => (
                <li key={t.id} className="rounded-full bg-slate-100 px-3 py-1 text-text-muted">
                  {subjectNameById.get(t.subjectId) ?? "?"} · {t.name}: {t.questionCount}
                </li>
              ))}
          </ul>
        )}

        <Button
          variant="ghost"
          className="mt-4 text-danger hover:bg-danger/10"
          onClick={handleDeleteAll}
          disabled={deleting || totalQuestions === 0}
        >
          {deleting ? "Đang xoá..." : "Xoá toàn bộ ngân hàng"}
        </Button>
      </div>

      <ManualQuestionsPanel password={password} onQuestionCountChanged={loadSummary} />

      <div className="rounded-2xl bg-surface p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-text">Import câu hỏi từ Excel</h2>

        <Button variant="secondary" onClick={downloadTemplate} className="mb-4">
          Tải template Excel
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="mb-4 block w-full text-sm text-text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-medium file:text-primary"
        />

        {fileName && <p className="mb-2 text-sm text-text-muted">File: {fileName}</p>}

        {importErrors.length > 0 && (
          <div className="mb-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">Có {importErrors.length} lỗi:</p>
            <ul className="mt-1 list-disc pl-5">
              {importErrors.slice(0, 20).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            {importErrors.length > 20 && <p className="mt-1">... và {importErrors.length - 20} lỗi khác.</p>}
          </div>
        )}

        {previewRows.length > 0 && (
          <>
            <p className="mb-2 text-sm text-text-muted">Xem trước {previewRows.length} câu hợp lệ:</p>
            <div className="mb-4 max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-140 text-left text-xs">
                <thead className="bg-primary/5 text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Môn</th>
                    <th className="px-3 py-2">Chủ đề</th>
                    <th className="px-3 py-2">Câu hỏi</th>
                    <th className="px-3 py-2">Đáp án</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.subject}</td>
                      <td className="px-3 py-2">{row.topic}</td>
                      <td className="px-3 py-2">{row.question}</td>
                      <td className="px-3 py-2 font-medium text-success">{row.answer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 50 && (
                <p className="p-2 text-center text-xs text-text-muted">
                  ... và {previewRows.length - 50} câu khác.
                </p>
              )}
            </div>

            <div className="mb-4 flex gap-4 text-sm text-text">
              <label className="flex items-center gap-2">
                <input type="radio" name="import-mode" checked={mode === "append"} onChange={() => setMode("append")} />
                Nối thêm
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                Thay thế toàn bộ
              </label>
            </div>

            <Button onClick={handleConfirmImport} disabled={importState === "importing"} className="w-full">
              {importState === "importing" ? "Đang import..." : "Xác nhận import"}
            </Button>
          </>
        )}

        {importResult && (
          <div className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            <p>
              Đã thêm {importResult.insertedQuestions} câu, bỏ qua {importResult.skipped} câu lỗi.
              {importResult.createdSubjects > 0 && ` Tạo mới ${importResult.createdSubjects} môn.`}
              {importResult.createdTopics > 0 && ` Tạo mới ${importResult.createdTopics} chủ đề.`}
            </p>
            {importResult.createdTopics > 0 && (
              <p className="mt-1 font-medium">
                ⚠️ {importResult.createdTopics} chủ đề mới đang &quot;chưa định giá&quot; — vào tab &quot;Môn học /
                Chủ đề&quot; để đặt giá trước khi mở bán.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
