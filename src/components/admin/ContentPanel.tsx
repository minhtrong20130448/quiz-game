"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

interface AdminSubject {
  id: string;
  name: string;
  description: string | null;
  topicCount: number;
}

interface AdminTopic {
  id: string;
  subjectId: string;
  name: string;
  price: number | null;
  finalPrice: number | null;
  discountPercent: number | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  discountActive: boolean;
  isActive: boolean;
  questionCount: number;
}

type LoadState = "loading" | "ready" | "error";

function formatPrice(price: number | null): string {
  if (price === null) return "Chưa định giá";
  if (price === 0) return "Miễn phí";
  return `${price.toLocaleString("vi-VN")}đ`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "?";
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chuyển ISO (UTC) sang giá trị cho <input type="datetime-local"> (giờ địa phương). */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContentPanel({ password }: { password: string }) {
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionError, setActionError] = useState<string | null>(null);

  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectDescription, setEditSubjectDescription] = useState("");

  const [addingTopicFor, setAddingTopicFor] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicPrice, setNewTopicPrice] = useState("");
  const [newTopicActive, setNewTopicActive] = useState(true);
  const [creatingTopic, setCreatingTopic] = useState(false);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicPrice, setEditTopicPrice] = useState("");
  const [editTopicActive, setEditTopicActive] = useState(true);

  const [discountEditingTopicId, setDiscountEditingTopicId] = useState<string | null>(null);
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [discountStartInput, setDiscountStartInput] = useState("");
  const [discountEndInput, setDiscountEndInput] = useState("");
  const [savingDiscount, setSavingDiscount] = useState(false);

  async function load() {
    try {
      const [subjectsRes, topicsRes] = await Promise.all([
        fetch("/api/admin/subjects", { headers: { "x-admin-password": password } }),
        fetch("/api/admin/topics", { headers: { "x-admin-password": password } }),
      ]);
      if (!subjectsRes.ok || !topicsRes.ok) throw new Error("failed to load");
      const subjectsData: AdminSubject[] = await subjectsRes.json();
      const topicsData: AdminTopic[] = await topicsRes.json();
      setSubjects(subjectsData);
      setTopics(topicsData);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    // `load` chỉ setState sau khi `await fetch(...)` xong (không đồng bộ) — an toàn để
    // gọi khi mount, nhưng lint không lần theo được thân hàm khai báo ngoài effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parsePriceInput(raw: string): { ok: true; value: number | null } | { ok: false } {
    if (!raw.trim()) return { ok: true, value: null };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return { ok: false };
    return { ok: true, value: n };
  }

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newSubjectName.trim();
    if (!trimmed) return;

    setCreatingSubject(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ name: trimmed, description: newSubjectDescription.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tạo được môn học.");
      setNewSubjectName("");
      setNewSubjectDescription("");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tạo được môn học.");
    } finally {
      setCreatingSubject(false);
    }
  }

  function startEditSubject(subject: AdminSubject) {
    setEditingSubjectId(subject.id);
    setEditSubjectName(subject.name);
    setEditSubjectDescription(subject.description ?? "");
  }

  async function handleSaveSubject(id: string) {
    const trimmed = editSubjectName.trim();
    if (!trimmed) return;

    setActionError(null);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ id, name: trimmed, description: editSubjectDescription.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được môn học.");
      setEditingSubjectId(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không lưu được môn học.");
    }
  }

  async function handleDeleteSubject(subject: AdminSubject) {
    const confirmed = window.confirm(
      `Xoá môn "${subject.name}"? Toàn bộ ${subject.topicCount} chủ đề và câu hỏi bên trong sẽ bị xoá theo, KHÔNG thể hoàn tác.`
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      const res = await fetch(`/api/admin/subjects?id=${subject.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Không xoá được môn học.");
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không xoá được môn học.");
    }
  }

  function startAddTopic(subjectId: string) {
    setAddingTopicFor(subjectId);
    setNewTopicName("");
    setNewTopicPrice("");
    setNewTopicActive(true);
  }

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>, subjectId: string) {
    event.preventDefault();
    const trimmed = newTopicName.trim();
    if (!trimmed) return;
    const parsedPrice = parsePriceInput(newTopicPrice);
    if (!parsedPrice.ok) {
      setActionError("Giá phải là số nguyên >= 0 (để trống = chưa định giá).");
      return;
    }

    setCreatingTopic(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          subjectId,
          name: trimmed,
          price: parsedPrice.value,
          isActive: newTopicActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tạo được chủ đề.");
      setAddingTopicFor(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không tạo được chủ đề.");
    } finally {
      setCreatingTopic(false);
    }
  }

  function startEditTopic(topic: AdminTopic) {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicPrice(topic.price === null ? "" : String(topic.price));
    setEditTopicActive(topic.isActive);
  }

  async function handleSaveTopic(id: string) {
    const trimmed = editTopicName.trim();
    if (!trimmed) return;
    const parsedPrice = parsePriceInput(editTopicPrice);
    if (!parsedPrice.ok) {
      setActionError("Giá phải là số nguyên >= 0 (để trống = chưa định giá).");
      return;
    }

    setActionError(null);
    try {
      const res = await fetch("/api/admin/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          id,
          name: trimmed,
          price: parsedPrice.value,
          isActive: editTopicActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được chủ đề.");
      setEditingTopicId(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không lưu được chủ đề.");
    }
  }

  async function handleDeleteTopic(topic: AdminTopic) {
    const confirmed = window.confirm(
      `Xoá chủ đề "${topic.name}"? ${topic.questionCount} câu hỏi bên trong sẽ bị xoá theo, KHÔNG thể hoàn tác.`
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      const res = await fetch(`/api/admin/topics?id=${topic.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Không xoá được chủ đề.");
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không xoá được chủ đề.");
    }
  }

  function startEditDiscount(topic: AdminTopic) {
    setDiscountEditingTopicId(topic.id);
    setDiscountPercentInput(topic.discountPercent === null ? "" : String(topic.discountPercent));
    setDiscountStartInput(toDatetimeLocalValue(topic.discountStartsAt));
    setDiscountEndInput(toDatetimeLocalValue(topic.discountEndsAt));
  }

  async function handleSaveDiscount(topicId: string) {
    const trimmedPercent = discountPercentInput.trim();
    // Để trống % rồi Lưu = xoá giảm giá.
    let payload: Record<string, unknown>;

    if (!trimmedPercent) {
      payload = { discountPercent: null, discountStartsAt: null, discountEndsAt: null };
    } else {
      const percent = Number(trimmedPercent);
      if (!Number.isInteger(percent) || percent <= 0 || percent > 100) {
        setActionError("% giảm giá phải là số nguyên 1-100.");
        return;
      }
      if (!discountStartInput || !discountEndInput) {
        setActionError("Cần chọn đủ ngày bắt đầu và ngày kết thúc giảm giá.");
        return;
      }
      const start = new Date(discountStartInput);
      const end = new Date(discountEndInput);
      if (start.getTime() > end.getTime()) {
        setActionError("Ngày bắt đầu giảm giá phải trước hoặc bằng ngày kết thúc.");
        return;
      }
      payload = {
        discountPercent: percent,
        discountStartsAt: start.toISOString(),
        discountEndsAt: end.toISOString(),
      };
    }

    setSavingDiscount(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ id: topicId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được giảm giá.");
      setDiscountEditingTopicId(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không lưu được giảm giá.");
    } finally {
      setSavingDiscount(false);
    }
  }

  if (loadState === "loading") {
    return <p className="p-6 text-center text-text-muted">Đang tải...</p>;
  }
  if (loadState === "error") {
    return <p className="p-6 text-center text-danger">Không tải được dữ liệu.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{actionError}</p>
      )}

      <div className="rounded-2xl bg-surface p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-text">Thêm môn học</h2>
        <form onSubmit={handleCreateSubject} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="Tên môn học"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <input
            value={newSubjectDescription}
            onChange={(e) => setNewSubjectDescription(e.target.value)}
            placeholder="Mô tả (tuỳ chọn)"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <Button type="submit" disabled={creatingSubject || !newSubjectName.trim()}>
            {creatingSubject ? "Đang thêm..." : "Thêm môn"}
          </Button>
        </form>
      </div>

      {subjects.length === 0 ? (
        <p className="p-6 text-center text-text-muted">Chưa có môn học nào.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {subjects.map((subject) => {
            const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
            const isEditing = editingSubjectId === subject.id;

            return (
              <div key={subject.id} className="rounded-2xl bg-surface p-6 shadow-xl">
                {isEditing ? (
                  <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row">
                    <input
                      value={editSubjectName}
                      onChange={(e) => setEditSubjectName(e.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <input
                      value={editSubjectDescription}
                      onChange={(e) => setEditSubjectDescription(e.target.value)}
                      placeholder="Mô tả (tuỳ chọn)"
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" onClick={() => handleSaveSubject(subject.id)}>
                        Lưu
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingSubjectId(null)}>
                        Huỷ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-text">{subject.name}</h3>
                      {subject.description && (
                        <p className="text-sm text-text-muted">{subject.description}</p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">{subject.topicCount} chủ đề</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" onClick={() => startEditSubject(subject)}>
                        Sửa
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-danger hover:bg-danger/10"
                        onClick={() => handleDeleteSubject(subject)}
                      >
                        Xoá
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {subjectTopics.length === 0 && addingTopicFor !== subject.id && (
                    <p className="text-sm text-text-muted">Môn này chưa có chủ đề nào.</p>
                  )}

                  {subjectTopics.map((topic) => {
                    const isEditingTopic = editingTopicId === topic.id;
                    return (
                      <div
                        key={topic.id}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        {isEditingTopic ? (
                          <div className="flex flex-1 flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
                            <input
                              value={editTopicName}
                              onChange={(e) => setEditTopicName(e.target.value)}
                              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:basis-40"
                            />
                            <input
                              value={editTopicPrice}
                              onChange={(e) => setEditTopicPrice(e.target.value)}
                              placeholder="Giá (VND), để trống = chưa định giá"
                              inputMode="numeric"
                              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:basis-56"
                            />
                            <label className="flex shrink-0 items-center gap-2 text-sm text-text">
                              <input
                                type="checkbox"
                                checked={editTopicActive}
                                onChange={(e) => setEditTopicActive(e.target.checked)}
                              />
                              Mở bán
                            </label>
                            <div className="flex shrink-0 gap-2">
                              <Button type="button" onClick={() => handleSaveTopic(topic.id)}>
                                Lưu
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditingTopicId(null)}>
                                Huỷ
                              </Button>
                            </div>
                          </div>
                        ) : discountEditingTopicId === topic.id ? (
                          <div className="flex flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={discountPercentInput}
                                onChange={(e) => setDiscountPercentInput(e.target.value)}
                                placeholder="% giảm (để trống = xoá giảm giá)"
                                inputMode="numeric"
                                className="min-h-11 w-56 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                              />
                              <label className="flex shrink-0 items-center gap-2 text-sm text-text-muted">
                                Từ
                                <input
                                  type="datetime-local"
                                  value={discountStartInput}
                                  onChange={(e) => setDiscountStartInput(e.target.value)}
                                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                />
                              </label>
                              <label className="flex shrink-0 items-center gap-2 text-sm text-text-muted">
                                Đến
                                <input
                                  type="datetime-local"
                                  value={discountEndInput}
                                  onChange={(e) => setDiscountEndInput(e.target.value)}
                                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                />
                              </label>
                            </div>
                            <p className="text-xs text-text-muted">Để trống ô % rồi bấm Lưu để xoá giảm giá.</p>
                            <div className="flex shrink-0 gap-2">
                              <Button type="button" onClick={() => handleSaveDiscount(topic.id)} disabled={savingDiscount}>
                                {savingDiscount ? "Đang lưu..." : "Lưu giảm giá"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDiscountEditingTopicId(null)}
                                disabled={savingDiscount}
                              >
                                Huỷ
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="font-medium text-text">
                                {topic.name}{" "}
                                <span className="text-xs font-normal text-text-muted">
                                  ({topic.questionCount} câu)
                                </span>
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span
                                  className={`rounded-full px-2 py-0.5 font-medium ${
                                    topic.price === null
                                      ? "bg-danger/10 text-danger"
                                      : topic.price === 0
                                        ? "bg-secondary/10 text-secondary"
                                        : "bg-primary/10 text-primary"
                                  }`}
                                >
                                  {topic.discountActive ? (
                                    <>
                                      <span className="line-through opacity-60">{formatPrice(topic.price)}</span>{" "}
                                      {formatPrice(topic.finalPrice)}
                                    </>
                                  ) : (
                                    formatPrice(topic.price)
                                  )}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 font-medium ${
                                    topic.isActive ? "bg-success/10 text-success" : "bg-slate-100 text-text-muted"
                                  }`}
                                >
                                  {topic.isActive ? "Đang mở bán" : "Đã tắt"}
                                </span>
                                {topic.discountPercent !== null && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-medium ${
                                      topic.discountActive ? "bg-danger/10 text-danger" : "bg-slate-100 text-text-muted"
                                    }`}
                                  >
                                    {topic.discountActive ? "Đang" : "Đã đặt"} giảm {topic.discountPercent}% (
                                    {formatDate(topic.discountStartsAt)} → {formatDate(topic.discountEndsAt)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button variant="ghost" onClick={() => startEditTopic(topic)}>
                                Sửa
                              </Button>
                              {topic.price !== null && (
                                <Button variant="ghost" onClick={() => startEditDiscount(topic)}>
                                  Giảm giá
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                className="text-danger hover:bg-danger/10"
                                onClick={() => handleDeleteTopic(topic)}
                              >
                                Xoá
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {addingTopicFor === subject.id ? (
                    <form
                      onSubmit={(e) => handleCreateTopic(e, subject.id)}
                      className="flex flex-col flex-wrap gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <input
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        placeholder="Tên chủ đề"
                        autoFocus
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:basis-40"
                      />
                      <input
                        value={newTopicPrice}
                        onChange={(e) => setNewTopicPrice(e.target.value)}
                        placeholder="Giá (VND), để trống = chưa định giá"
                        inputMode="numeric"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:basis-56"
                      />
                      <label className="flex shrink-0 items-center gap-2 text-sm text-text">
                        <input
                          type="checkbox"
                          checked={newTopicActive}
                          onChange={(e) => setNewTopicActive(e.target.checked)}
                        />
                        Mở bán
                      </label>
                      <div className="flex shrink-0 gap-2">
                        <Button type="submit" disabled={creatingTopic || !newTopicName.trim()}>
                          {creatingTopic ? "Đang thêm..." : "Thêm"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setAddingTopicFor(null)}>
                          Huỷ
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button variant="secondary" className="self-start" onClick={() => startAddTopic(subject.id)}>
                      + Thêm chủ đề
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
