"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ProtectedContentProps {
  /** Tên người chơi — in vào watermark để truy được ai làm lộ nội dung. */
  username: string;
  /** Mã đơn (memo_code) — định danh lượt chơi đang xem, in kèm watermark. */
  code: string;
  children: ReactNode;
}

const WATERMARK_TILE_COUNT = 70;
const WATERMARK_UPDATE_INTERVAL_MS = 1000;

function formatTimestamp(date: Date): string {
  return date.toLocaleString("vi-VN", { hour12: false });
}

/**
 * Bọc quanh nội dung câu hỏi/kết quả để GIẢM rò rỉ, không chặn được chụp màn hình
 * tuyệt đối (điện thoại chụp từ bên ngoài, hoặc OS chặn được sự kiện DOM, web không
 * can thiệp được). Đây là biện pháp răn đe + truy vết (watermark định danh), không
 * phải giải pháp bảo mật đáng tin cậy 100%.
 */
export function ProtectedContent({ username, code, children }: ProtectedContentProps) {
  const [now, setNow] = useState(() => new Date());
  const [hidden, setHidden] = useState(false);
  // Mặc định BẬT trong lúc chờ tải cài đặt — an toàn hơn là mặc định tắt bảo vệ.
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data: { watermarkEnabled: boolean } = await res.json();
        if (!cancelled) setWatermarkEnabled(data.watermarkEnabled);
      } catch {
        // Tải cài đặt lỗi thì giữ nguyên mặc định (đang bật) — không hạ bảo vệ vì lỗi mạng.
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!watermarkEnabled) return;
    const interval = setInterval(() => setNow(new Date()), WATERMARK_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [watermarkEnabled]);

  useEffect(() => {
    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    function handleCopyOrCut(e: ClipboardEvent) {
      e.preventDefault();
    }
    function handleDragStart(e: DragEvent) {
      e.preventDefault();
    }
    // Best-effort: bắt phím PrintScreen ở tầng trình duyệt. KHÔNG đáng tin — hệ điều
    // hành chụp màn hình ở tầng thấp hơn JS/trình duyệt nên vẫn chụp được bình thường.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
    }
    function handleVisibilityChange() {
      setHidden(document.visibilityState === "hidden");
    }
    function handleBlur() {
      setHidden(true);
    }
    function handleFocus() {
      setHidden(false);
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyOrCut);
    document.addEventListener("cut", handleCopyOrCut);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyOrCut);
      document.removeEventListener("cut", handleCopyOrCut);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const watermarkText = `${username} · ${code} · ${formatTimestamp(now)}`;

  return (
    <div style={{ userSelect: "none" }} onDragStart={(e) => e.preventDefault()}>
      {children}

      {watermarkEnabled && (
        <>
          {/* Watermark động: lặp chéo khắp màn hình, pointer-events:none để không cản
              thao tác chơi. Đè lên toàn bộ viewport (fixed) nên vẫn phủ khi nội dung
              dài/cuộn. */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 flex w-[160vw] -translate-x-1/2 -translate-y-1/2 rotate-[-24deg] flex-wrap gap-x-10 gap-y-8 opacity-[0.08]">
              {Array.from({ length: WATERMARK_TILE_COUNT }).map((_, i) => (
                <span key={i} className="whitespace-nowrap text-xs font-semibold text-slate-900">
                  {watermarkText}
                </span>
              ))}
            </div>
          </div>

          <div className="pointer-events-none fixed bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-center text-[11px] text-white/80">
            Nội dung có đóng dấu định danh, không chia sẻ ra ngoài.
          </div>
        </>
      )}

      {hidden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 px-6 text-center text-white">
          <p className="text-lg font-semibold">Nội dung đang được bảo vệ</p>
        </div>
      )}
    </div>
  );
}
