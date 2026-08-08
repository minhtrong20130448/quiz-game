"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/Button";
import type { TopicCount } from "@/lib/types";
import { downloadTemplate, parseQuestionsSheet, validateImportRow, type ValidImportRow } from "@/lib/excelQuestions";

type ImportMode = "replace" | "append";
type TopicsLoadState = "loading" | "ready" | "error";
type ImportState = "idle" | "importing" | "done" | "error";

export function QuestionsPanel({ password }: { password: string }) {
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [topicsLoadState, setTopicsLoadState] = useState<TopicsLoadState>("loading");
  const [previewRows, setPreviewRows] = useState<ValidImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("append");
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [importState, setImportState] = useState<ImportState>("idle");
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadTopics() {
    try {
      const res = await fetch("/api/topics");
      if (!res.ok) throw new Error("failed to load topics");
      const data: TopicCount[] = await res.json();
      setTopics(data);
      setTopicsLoadState("ready");
    } catch {
      setTopicsLoadState("error");
    }
  }

  useEffect(() => {
    // `loadTopics` chỉ setState sau khi `await fetch(...)` xong (không đồng bộ) — an
    // toàn để gọi khi mount, nhưng lint không lần theo được thân hàm khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTopics();
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
      const res = await fetch("/api/admin/questions", {
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

      setImportResult({ inserted: data.inserted, skipped: data.skipped });
      setImportState("done");
      setPreviewRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadTopics();
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
      if (res.ok) await loadTopics();
    } finally {
      setDeleting(false);
    }
  }

  const totalQuestions = topics.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-surface p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-text">Số câu hiện có</h2>

        {topicsLoadState === "loading" ? (
          <p className="text-text-muted">Đang tải...</p>
        ) : topicsLoadState === "error" ? (
          <p className="text-danger">Không tải được.</p>
        ) : topics.length === 0 ? (
          <p className="text-text-muted">Chưa có câu hỏi nào trong ngân hàng.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
              Tổng: {totalQuestions} câu
            </li>
            {topics.map((t) => (
              <li key={t.topic} className="rounded-full bg-slate-100 px-3 py-1 text-text-muted">
                {t.topic}: {t.count}
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
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-primary/5 text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Chủ đề</th>
                    <th className="px-3 py-2">Câu hỏi</th>
                    <th className="px-3 py-2">Đáp án</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
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
          <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            Đã thêm {importResult.inserted} câu, bỏ qua {importResult.skipped} câu lỗi.
          </p>
        )}
      </div>
    </div>
  );
}
