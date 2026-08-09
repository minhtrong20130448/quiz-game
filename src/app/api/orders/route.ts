import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const MAX_USERNAME_LENGTH = 30;
const MEMO_PREFIX = "QZ";
// Bỏ ký tự dễ nhầm khi đọc bằng mắt/OCR (0/O, 1/I/L).
const MEMO_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MEMO_RANDOM_LENGTH = 8;
const MAX_MEMO_ATTEMPTS = 5;
const UNIQUE_VIOLATION_CODE = "23505";

function generateMemoCode(): string {
  let code = MEMO_PREFIX;
  for (let i = 0; i < MEMO_RANDOM_LENGTH; i++) {
    code += MEMO_CHARS[Math.floor(Math.random() * MEMO_CHARS.length)];
  }
  return code;
}

interface TopicRow {
  id: string;
  price: number | null;
  is_active: boolean;
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

  const { topicId, username } = body as Record<string, unknown>;
  const trimmedUsername =
    typeof username === "string" ? username.trim().slice(0, MAX_USERNAME_LENGTH) : "";

  if (!trimmedUsername) {
    return NextResponse.json({ error: "Thiếu username." }, { status: 400 });
  }
  if (typeof topicId !== "string" || !topicId) {
    return NextResponse.json({ error: "Thiếu topicId." }, { status: 400 });
  }

  const { data: topic, error: topicError } = await supabaseAdmin
    .from("topics")
    .select("id, price, is_active")
    .eq("id", topicId)
    .maybeSingle<TopicRow>();

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 });
  }
  if (!topic || !topic.is_active || topic.price === null) {
    return NextResponse.json(
      { error: "Chủ đề không tồn tại hoặc chưa mở bán." },
      { status: 400 }
    );
  }

  const { count: questionCount, error: countError } = await supabaseAdmin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if (!questionCount) {
    return NextResponse.json({ error: "Chủ đề chưa có câu hỏi." }, { status: 400 });
  }

  const amount = topic.price;
  // Chủ đề miễn phí: tạo đơn ở trạng thái 'paid' luôn, bỏ qua bước chờ chuyển khoản.
  const isFree = amount === 0;
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < MAX_MEMO_ATTEMPTS; attempt++) {
    const memoCode = generateMemoCode();

    const { data: order, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        topic_id: topicId,
        username: trimmedUsername,
        amount,
        memo_code: memoCode,
        status: isFree ? "paid" : "pending",
        paid_at: isFree ? now : null,
      })
      .select("id, memo_code, amount, status")
      .single();

    if (!insertError) {
      return NextResponse.json(
        {
          orderId: order.id,
          memoCode: order.memo_code,
          amount: order.amount,
          status: order.status,
          bank: {
            bin: process.env.BANK_BIN ?? "",
            accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "",
            accountName: process.env.BANK_ACCOUNT_NAME ?? "",
          },
        },
        { status: 201 }
      );
    }

    // memo_code trùng (rất hiếm) -> thử lại với mã khác; lỗi khác thì trả về luôn.
    if (insertError.code !== UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Không tạo được mã đơn, thử lại." }, { status: 500 });
}
