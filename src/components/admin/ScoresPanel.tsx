"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import type { AdminScoreEntry } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

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

export function ScoresPanel({ password }: { password: string }) {
  const [rows, setRows] = useState<AdminScoreEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load(usernameFilter: string) {
    try {
      const params = new URLSearchParams();
      if (usernameFilter.trim()) params.set("username", usernameFilter.trim());
      const res = await fetch(`/api/admin/scores?${params.toString()}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("failed to load scores");
      const data: AdminScoreEntry[] = await res.json();
      setRows(data);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    // `load` chỉ setState sau khi `await fetch(...)` xong (không đồng bộ) — an toàn để
    // gọi khi mount, nhưng lint không lần theo được thân hàm khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadState("loading");
    load(search);
  }

  function handleReset() {
    setSearch("");
    setLoadState("loading");
    load("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên..."
          className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <Button type="submit" variant="secondary">
          Tìm
        </Button>
        <Button type="button" variant="ghost" onClick={handleReset}>
          Làm mới
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-xl">
        {loadState === "loading" ? (
          <p className="p-6 text-center text-text-muted">Đang tải...</p>
        ) : loadState === "error" ? (
          <p className="p-6 text-center text-danger">Không tải được dữ liệu.</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-text-muted">Không có lượt chơi nào.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-primary/5 text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Chủ đề</th>
                <th className="px-4 py-3 font-medium">Điểm</th>
                <th className="px-4 py-3 font-medium">Đúng</th>
                <th className="px-4 py-3 font-medium">Sai</th>
                <th className="px-4 py-3 font-medium">Tổng câu</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className="cursor-pointer border-t border-slate-100 hover:bg-primary/5"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-4 py-3">{row.username}</td>
                    <td className="px-4 py-3">{row.topic === "ALL" ? "Tất cả" : row.topic}</td>
                    <td className="px-4 py-3 font-semibold text-accent">{row.score}</td>
                    <td className="px-4 py-3 text-success">{row.correct_count}</td>
                    <td className="px-4 py-3 text-danger">{row.wrong_count}</td>
                    <td className="px-4 py-3">{row.total_questions}</td>
                    <td className="px-4 py-3 text-text-muted">{formatTime(row.created_at)}</td>
                  </tr>
                  {expandedId === row.id && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={7} className="px-4 py-3">
                        {row.wrong_details.length === 0 ? (
                          <p className="text-sm text-success">Không sai câu nào.</p>
                        ) : (
                          <ul className="flex flex-col gap-2 text-sm">
                            {row.wrong_details.map((w, i) => (
                              <li key={i}>
                                <span className="font-medium text-text">{w.question}</span>{" "}
                                <span className="text-danger">— chọn: {w.chosen}</span>{" "}
                                <span className="text-success">— đúng: {w.correct}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
