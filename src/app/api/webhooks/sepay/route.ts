import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

interface SepayPayload {
  content?: string;
  code?: string | null;
  transferAmount?: number;
  transferType?: string;
}

interface PendingOrderRow {
  id: string;
  memo_code: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  const expectedKey = process.env.SEPAY_WEBHOOK_API_KEY;
  const authHeader = request.headers.get("authorization") ?? "";

  // SePay gửi header dạng "Authorization: Apikey <key>" — chỉ cần header CHỨA key cấu hình.
  if (!expectedKey || !authHeader.includes(expectedKey)) {
    return NextResponse.json({ error: "Sai API key." }, { status: 401 });
  }

  let payload: SepayPayload;
  try {
    payload = (await request.json()) as SepayPayload;
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  // Chỉ xử lý giao dịch tiền VÀO; bỏ qua tiền ra (rút/chuyển đi).
  if (payload.transferType && payload.transferType !== "in") {
    return NextResponse.json({ ok: true, skipped: "not_incoming" });
  }

  const content = `${payload.content ?? ""} ${payload.code ?? ""}`.toUpperCase();
  const transferAmount = payload.transferAmount;

  if (!content.trim() || typeof transferAmount !== "number") {
    return NextResponse.json({ ok: true, skipped: "missing_content_or_amount" });
  }

  const { data: pendingOrders, error } = await supabaseAdmin
    .from("orders")
    .select("id, memo_code, amount")
    .eq("status", "pending")
    .returns<PendingOrderRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matched = pendingOrders.find((o) => content.includes(o.memo_code.toUpperCase()));

  if (!matched) {
    return NextResponse.json({ ok: true, skipped: "no_matching_order" });
  }
  if (matched.amount !== transferAmount) {
    return NextResponse.json({ ok: true, skipped: "amount_mismatch" });
  }

  // .eq("status", "pending") lần nữa để cập nhật nguyên tử + idempotent: nếu order đã
  // 'paid' từ trước (webhook gọi lại/trùng) thì không ghi đè lại paid_at.
  const { data: updatedOrders, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", matched.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderId: matched.id, updated: updatedOrders.length > 0 });
}
