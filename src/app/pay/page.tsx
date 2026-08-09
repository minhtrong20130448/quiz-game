"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type PageState = "creating" | "waiting" | "paid" | "expired" | "error";

interface OrderInfo {
  orderId: string;
  memoCode: string;
  amount: number;
  bank: { bin: string; accountNumber: string; accountName: string };
}

const POLL_INTERVAL_MS = 3000;

function formatAmount(amount: number): string {
  return amount === 0 ? "Miễn phí" : `${amount.toLocaleString("vi-VN")}đ`;
}

export default function PayPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("creating");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const createdRef = useRef(false);

  useEffect(() => {
    const username = sessionStorage.getItem("quizUsername");
    const topicId = sessionStorage.getItem("quizTopicId");

    if (!username || !topicId) {
      router.replace("/");
      return;
    }

    // React chạy effect 2 lần ở dev (StrictMode) — chặn tạo trùng 2 đơn.
    if (createdRef.current) return;
    createdRef.current = true;

    async function createOrder() {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId, username }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Không tạo được đơn.");

        sessionStorage.setItem("quizOrderId", data.orderId as string);
        sessionStorage.setItem("quizMemoCode", data.memoCode as string);
        setOrder({
          orderId: data.orderId,
          memoCode: data.memoCode,
          amount: data.amount,
          bank: data.bank,
        });
        setState(data.status === "paid" ? "paid" : "waiting");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Không tạo được đơn.");
        setState("error");
      }
    }

    createOrder();
  }, [router]);

  useEffect(() => {
    if (state !== "waiting" || !order) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/status?orderId=${order.orderId}`);
        if (!res.ok) return;
        const data: { status: string } = await res.json();
        if (cancelled) return;
        if (data.status === "paid") setState("paid");
        else if (data.status === "expired") setState("expired");
      } catch {
        // Bỏ qua lỗi tạm thời của 1 lần poll, tự thử lại ở lần tiếp theo.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state, order]);

  function handleStartPlaying() {
    router.push("/quiz");
  }

  function handleBackHome() {
    sessionStorage.removeItem("quizOrderId");
    router.replace("/");
  }

  if (state === "creating") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <p className="text-text-muted">Đang tạo đơn...</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Card className="w-full">
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {errorMessage || "Có lỗi xảy ra, thử lại nha!"}
          </p>
          <Button variant="ghost" className="mt-4 w-full" onClick={handleBackHome}>
            Quay về trang chủ
          </Button>
        </Card>
      </main>
    );
  }

  if (!order) return null;

  if (state === "expired") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Card className="w-full">
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            Đơn đã hết hạn chờ thanh toán. Quay lại trang chủ để tạo đơn mới nha!
          </p>
          <Button className="mt-4 w-full" onClick={handleBackHome}>
            Quay về trang chủ
          </Button>
        </Card>
      </main>
    );
  }

  if (state === "paid") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Card className="w-full">
          <p className="text-lg font-semibold text-text">
            {order.amount === 0 ? "Chủ đề miễn phí — chơi ngay thôi!" : "Đã nhận thanh toán!"}
          </p>
          <p className="mt-1 text-sm text-text-muted">Mã đơn: {order.memoCode}</p>
          <Button className="mt-4 w-full" onClick={handleStartPlaying}>
            Bắt đầu chơi
          </Button>
        </Card>
      </main>
    );
  }

  // state === "waiting"
  const qrUrl =
    `https://img.vietqr.io/image/${order.bank.bin}-${order.bank.accountNumber}-compact2.png` +
    `?amount=${order.amount}&addInfo=${encodeURIComponent(order.memoCode)}` +
    `&accountName=${encodeURIComponent(order.bank.accountName)}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <Card className="w-full text-center">
        <p className="text-lg font-semibold text-text">Quét mã để thanh toán</p>
        <p className="mt-1 text-2xl font-bold text-primary">{formatAmount(order.amount)}</p>

        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR động từ img.vietqr.io, không cần Next Image optimize */}
        <img
          src={qrUrl}
          alt={`Mã QR chuyển khoản ${order.amount.toLocaleString("vi-VN")}đ, nội dung ${order.memoCode}`}
          className="mx-auto mt-4 w-full max-w-xs rounded-xl border border-slate-200"
        />

        <div className="mt-4 rounded-xl bg-secondary/10 px-4 py-3 text-sm text-text">
          Chuyển đúng số tiền, giữ nguyên nội dung{" "}
          <span className="font-semibold text-secondary">{order.memoCode}</span>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Đang chờ thanh toán...
        </p>
      </Card>
    </main>
  );
}
