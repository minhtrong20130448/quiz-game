"use client";

import { useEffect, useState } from "react";

type LoadState = "loading" | "ready" | "error";

export function SettingsPanel({ password }: { password: string }) {
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/settings", { headers: { "x-admin-password": password } });
      if (!res.ok) throw new Error("failed to load settings");
      const data: { watermarkEnabled: boolean } = await res.json();
      setWatermarkEnabled(data.watermarkEnabled);
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

  async function handleToggle(next: boolean) {
    const previous = watermarkEnabled;
    setWatermarkEnabled(next); // cập nhật lạc quan để nút phản hồi ngay
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ watermarkEnabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được cài đặt.");
      setWatermarkEnabled(data.watermarkEnabled);
    } catch (err) {
      setWatermarkEnabled(previous); // lưu lỗi thì trả lại trạng thái cũ
      setError(err instanceof Error ? err.message : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return <p className="p-6 text-center text-text-muted">Đang tải...</p>;
  }
  if (loadState === "error") {
    return <p className="p-6 text-center text-danger">Không tải được cài đặt.</p>;
  }

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-xl">
      <h2 className="mb-1 text-lg font-semibold text-text">Chống rò rỉ nội dung</h2>
      <p className="mb-4 text-sm text-text-muted">
        Watermark động (tên + mã đơn + giờ) đè lên màn hình chơi và kết quả — biện pháp răn đe/truy vết,
        không chặn chụp màn hình tuyệt đối. Các bảo vệ khác (chặn chuột phải/copy/kéo ảnh, che nội dung
        khi rời tab) luôn bật, không tắt được ở đây.
      </p>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
        <div>
          <p className="font-medium text-text">Bật watermark</p>
          <p className="text-sm text-text-muted">
            {watermarkEnabled ? "Đang bật — hiển thị trên /quiz và /result." : "Đang tắt — không hiển thị watermark."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={watermarkEnabled}
          disabled={saving}
          onClick={() => handleToggle(!watermarkEnabled)}
          className={`relative min-h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            watermarkEnabled ? "bg-primary" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              watermarkEnabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
