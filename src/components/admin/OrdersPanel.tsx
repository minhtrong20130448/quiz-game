"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import type { AdminScoreEntry } from "@/lib/types";

interface AdminOrderRow {
  id: string;
  username: string;
  subject: string;
  topic: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface TopicOption {
  id: string;
  subjectId: string;
  name: string;
}

type LoadState = "loading" | "ready" | "error";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "playing", label: "Đang chơi" },
  { value: "completed", label: "Đã chơi xong" },
  { value: "expired", label: "Hết hạn" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-text-muted",
  paid: "bg-primary/10 text-primary",
  playing: "bg-secondary/10 text-secondary",
  completed: "bg-success/10 text-success",
  expired: "bg-danger/10 text-danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  playing: "Đang chơi",
  completed: "Đã chơi xong",
  expired: "Hết hạn",
};

const REVENUE_STATUSES = new Set(["paid", "playing", "completed"]);

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number) {
  return amount === 0 ? "Miễn phí" : `${amount.toLocaleString("vi-VN")}đ`;
}

export function OrdersPanel({ password }: { password: string }) {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);

  const [status, setStatus] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [username, setUsername] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [scoresByOrder, setScoresByOrder] = useState<Record<string, AdminScoreEntry[] | "loading" | "error">>({});

  async function loadFilterOptions() {
    try {
      const [subjectsRes, topicsRes] = await Promise.all([
        fetch("/api/admin/subjects", { headers: { "x-admin-password": password } }),
        fetch("/api/admin/topics", { headers: { "x-admin-password": password } }),
      ]);
      if (!subjectsRes.ok || !topicsRes.ok) return;
      setSubjects(await subjectsRes.json());
      setTopics(await topicsRes.json());
    } catch {
      // Bộ lọc môn/chủ đề không tải được thì vẫn dùng được bảng đơn — bỏ qua lỗi.
    }
  }

  async function load() {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (subjectId) params.set("subject_id", subjectId);
      if (topicId) params.set("topic_id", topicId);
      if (username.trim()) params.set("username", username.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("failed to load orders");
      const data: AdminOrderRow[] = await res.json();
      setRows(data);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    // `load`/`loadFilterOptions` chỉ setState sau khi `await fetch(...)` xong (không
    // đồng bộ) — an toàn để gọi khi mount, nhưng lint không lần theo được thân hàm
    // khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadState("loading");
    load();
  }

  function handleReset() {
    setStatus("");
    setSubjectId("");
    setTopicId("");
    setUsername("");
    setFrom("");
    setTo("");
    setLoadState("loading");
    // Không dùng load() ở đây vì các state filter vừa set ở trên chưa kịp áp dụng
    // trong closure này (còn giá trị cũ) — gọi thẳng fetch không filter cho đơn giản.
    fetch("/api/admin/orders", { headers: { "x-admin-password": password } })
      .then((res) => res.json())
      .then((data: AdminOrderRow[]) => {
        setRows(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  async function handleToggleExpand(orderId: string) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (scoresByOrder[orderId] !== undefined) return;

    setScoresByOrder((prev) => ({ ...prev, [orderId]: "loading" }));
    try {
      const res = await fetch(`/api/admin/scores?order_id=${orderId}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("failed");
      const data: AdminScoreEntry[] = await res.json();
      setScoresByOrder((prev) => ({ ...prev, [orderId]: data }));
    } catch {
      setScoresByOrder((prev) => ({ ...prev, [orderId]: "error" }));
    }
  }

  const revenueRows = rows.filter((r) => REVENUE_STATUSES.has(r.status));
  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const expiredCount = rows.filter((r) => r.status === "expired").length;

  const countByTopic = new Map<string, { subject: string; topic: string; count: number }>();
  for (const r of rows) {
    const key = `${r.subject} · ${r.topic}`;
    const entry = countByTopic.get(key) ?? { subject: r.subject, topic: r.topic, count: 0 };
    entry.count += 1;
    countByTopic.set(key, entry);
  }

  const topicOptions = subjectId ? topics.filter((t) => t.subjectId === subjectId) : topics;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-surface p-4 shadow-xl">
          <p className="text-xs text-text-muted">Đơn đã thanh toán</p>
          <p className="mt-1 text-xl font-bold text-primary">{revenueRows.length}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-xl">
          <p className="text-xs text-text-muted">Tổng doanh thu</p>
          <p className="mt-1 text-xl font-bold text-success">{totalRevenue.toLocaleString("vi-VN")}đ</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-xl">
          <p className="text-xs text-text-muted">Chờ thanh toán</p>
          <p className="mt-1 text-xl font-bold text-text-muted">{pendingCount}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-xl">
          <p className="text-xs text-text-muted">Hết hạn</p>
          <p className="mt-1 text-xl font-bold text-danger">{expiredCount}</p>
        </div>
      </div>

      {countByTopic.size > 0 && (
        <div className="rounded-2xl bg-surface p-4 shadow-xl">
          <p className="mb-2 text-xs font-medium text-text-muted">Số đơn theo chủ đề (trong kết quả đang lọc)</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {[...countByTopic.values()].map((entry) => (
              <li key={`${entry.subject}-${entry.topic}`} className="rounded-full bg-slate-100 px-3 py-1 text-text-muted">
                {entry.subject} · {entry.topic}: {entry.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleFilterSubmit} className="flex flex-wrap gap-2 rounded-2xl bg-surface p-4 shadow-xl">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setTopicId("");
          }}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả môn</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tất cả chủ đề</option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tìm theo tên..."
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />

        <Button type="submit" variant="secondary">
          Lọc
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
          <p className="p-6 text-center text-text-muted">Không có đơn nào khớp bộ lọc.</p>
        ) : (
          <table className="w-full min-w-180 text-left text-sm">
            <thead className="bg-primary/5 text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Môn</th>
                <th className="px-4 py-3 font-medium">Chủ đề</th>
                <th className="px-4 py-3 font-medium">Số tiền</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Tạo lúc</th>
                <th className="px-4 py-3 font-medium">Thanh toán lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className="cursor-pointer border-t border-slate-100 hover:bg-primary/5"
                    onClick={() => handleToggleExpand(row.id)}
                  >
                    <td className="px-4 py-3">{row.username}</td>
                    <td className="px-4 py-3">{row.subject}</td>
                    <td className="px-4 py-3">{row.topic}</td>
                    <td className="px-4 py-3 font-semibold text-text">{formatAmount(row.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? ""}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatTime(row.createdAt)}</td>
                    <td className="px-4 py-3 text-text-muted">{formatTime(row.paidAt)}</td>
                  </tr>
                  {expandedOrderId === row.id && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={7} className="px-4 py-3">
                        {scoresByOrder[row.id] === "loading" ? (
                          <p className="text-sm text-text-muted">Đang tải điểm...</p>
                        ) : scoresByOrder[row.id] === "error" ? (
                          <p className="text-sm text-danger">Không tải được điểm.</p>
                        ) : !scoresByOrder[row.id] || (scoresByOrder[row.id] as AdminScoreEntry[]).length === 0 ? (
                          <p className="text-sm text-text-muted">
                            {row.status === "completed"
                              ? "Đơn đã chơi xong nhưng chưa thấy điểm."
                              : "Chưa chơi xong đơn này."}
                          </p>
                        ) : (
                          (scoresByOrder[row.id] as AdminScoreEntry[]).map((s) => (
                            <div key={s.id} className="text-sm">
                              <p className="font-medium text-text">
                                Điểm: <span className="text-accent">{s.score}</span> — Đúng {s.correct_count}/
                                {s.total_questions}
                              </p>
                              {s.wrong_details.length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1">
                                  {s.wrong_details.map((w, i) => (
                                    <li key={i}>
                                      <span className="font-medium text-text">{w.question}</span>{" "}
                                      <span className="text-danger">— chọn: {w.chosen}</span>{" "}
                                      <span className="text-success">— đúng: {w.correct}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))
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
