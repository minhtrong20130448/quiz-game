import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shuffle } from "@/lib/shuffle";

export const dynamic = "force-dynamic";

const QUESTION_COLUMNS = "id, question, option_a, option_b, option_c, option_d, answer, source";

interface OrderRow {
  id: string;
  status: string;
  topic_id: string;
  served_question_ids: unknown;
}

interface QuestionRow {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

function invalidTicket() {
  return NextResponse.json({ error: "Vé đã dùng hoặc không hợp lệ." }, { status: 403 });
}

function asIdArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  const { orderId } = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "Thiếu orderId." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, status, topic_id, served_question_ids")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }
  if (
    !order ||
    order.status === "completed" ||
    order.status === "expired" ||
    order.status === "pending"
  ) {
    return invalidTicket();
  }

  let servedIds = asIdArray(order.served_question_ids);

  if (order.status === "paid") {
    // Vé còn mới — chọn & xáo trộn bộ câu hỏi của chủ đề, tiêu vé (paid -> playing).
    const { data: topicQuestions, error: qIdsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("topic_id", order.topic_id)
      .returns<{ id: string }[]>();

    if (qIdsError) {
      return NextResponse.json({ error: qIdsError.message }, { status: 500 });
    }
    if (topicQuestions.length === 0) {
      return NextResponse.json({ error: "Chủ đề chưa có câu hỏi." }, { status: 403 });
    }

    servedIds = shuffle(topicQuestions.map((q) => q.id));

    // .eq("status", "paid") lần nữa: chỉ tiêu vé khi vẫn đang 'paid' — chặn tiêu 2 lần
    // nếu 2 request /api/play/start chạy song song (double-click, reload nhanh).
    const { data: transitioned, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "playing",
        play_started_at: new Date().toISOString(),
        served_question_ids: servedIds,
      })
      .eq("id", orderId)
      .eq("status", "paid")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!transitioned) {
      // Request khác đã tiêu vé trước ta trong lúc này -> đọc lại trạng thái mới nhất.
      const { data: refreshed, error: refreshError } = await supabaseAdmin
        .from("orders")
        .select("status, served_question_ids")
        .eq("id", orderId)
        .maybeSingle<{ status: string; served_question_ids: unknown }>();

      if (refreshError) {
        return NextResponse.json({ error: refreshError.message }, { status: 500 });
      }
      if (!refreshed || refreshed.status === "completed" || refreshed.status === "expired") {
        return invalidTicket();
      }
      servedIds = asIdArray(refreshed.served_question_ids);
    }
  }

  if (servedIds.length === 0) {
    return invalidTicket();
  }

  const [{ data: questions, error: questionsError }, { data: topic, error: topicError }] =
    await Promise.all([
      supabaseAdmin
        .from("questions")
        .select(QUESTION_COLUMNS)
        .in("id", servedIds)
        .returns<QuestionRow[]>(),
      supabaseAdmin
        .from("topics")
        .select("name")
        .eq("id", order.topic_id)
        .maybeSingle<{ name: string }>(),
    ]);

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }
  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 });
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const orderedQuestions = servedIds
    .map((id) => byId.get(id))
    .filter((q): q is QuestionRow => q !== undefined);

  return NextResponse.json({
    orderId: order.id,
    topicId: order.topic_id,
    topicName: topic?.name ?? "",
    questions: orderedQuestions,
  });
}
