import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const MAX_USERNAME_LENGTH = 30;

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const {
    username,
    topic,
    topicId,
    orderId,
    score,
    correct_count,
    wrong_count,
    total_questions,
    wrong_details,
  } = body as Record<string, unknown>;

  const trimmedUsername = typeof username === "string" ? username.trim().slice(0, MAX_USERNAME_LENGTH) : "";
  if (!trimmedUsername) {
    return NextResponse.json({ error: "Thiếu username." }, { status: 400 });
  }

  if (
    !isNonNegativeInt(score) ||
    !isNonNegativeInt(correct_count) ||
    !isNonNegativeInt(wrong_count) ||
    !isNonNegativeInt(total_questions)
  ) {
    return NextResponse.json({ error: "Điểm số không hợp lệ." }, { status: 400 });
  }

  const safeTopic = typeof topic === "string" && topic.trim() ? topic.trim() : "ALL";
  const safeTopicId = typeof topicId === "string" && topicId ? topicId : null;
  const safeOrderId = typeof orderId === "string" && orderId ? orderId : null;
  const safeWrongDetails = Array.isArray(wrong_details) ? wrong_details : [];

  if (safeOrderId) {
    // Tiêu vé lần cuối: playing -> completed. Chỉ đổi khi vẫn đang 'playing' — nếu đơn
    // đã 'completed' từ trước (VD: người chơi reload /result gửi lại điểm) thì coi như
    // đã lưu rồi, KHÔNG chèn thêm dòng điểm trùng.
    const { data: completedOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", safeOrderId)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }
    if (!completedOrder) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const { error } = await supabaseAdmin.from("scores").insert({
    username: trimmedUsername,
    topic: safeTopic,
    topic_id: safeTopicId,
    order_id: safeOrderId,
    score,
    correct_count,
    wrong_count,
    total_questions,
    wrong_details: safeWrongDetails,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
