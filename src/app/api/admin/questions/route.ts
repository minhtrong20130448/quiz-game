import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);

interface QuestionListItem {
  id: string;
  question: string;
  answer: string;
}

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const topicId = request.nextUrl.searchParams.get("topic_id");
  if (!topicId) {
    return NextResponse.json({ error: "Thiếu topic_id." }, { status: 400 });
  }

  // Danh sách rút gọn (không kèm 4 phương án) — tránh tải/hiển thị nặng khi 1 chủ đề
  // có nhiều câu; xem chi tiết từng câu qua GET /api/admin/questions/[id].
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id, question, answer")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true })
    .returns<QuestionListItem[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const { topicId, question, option_a, option_b, option_c, option_d, answer, source } =
    body as Record<string, unknown>;

  const trimmedTopicId = typeof topicId === "string" ? topicId : "";
  const trimmedQuestion = typeof question === "string" ? question.trim() : "";
  const a = typeof option_a === "string" ? option_a.trim() : "";
  const b = typeof option_b === "string" ? option_b.trim() : "";
  const c = typeof option_c === "string" ? option_c.trim() : "";
  const d = typeof option_d === "string" ? option_d.trim() : "";
  const ans = typeof answer === "string" ? answer.trim().toUpperCase() : "";
  const safeSource = typeof source === "string" && source.trim() ? source.trim() : null;

  if (!trimmedTopicId || !trimmedQuestion || !a || !b || !c || !d) {
    return NextResponse.json({ error: "Thiếu topicId/question/phương án." }, { status: 400 });
  }
  if (!VALID_ANSWERS.has(ans)) {
    return NextResponse.json({ error: "answer phải là A/B/C/D." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("questions")
    .insert({
      topic_id: trimmedTopicId,
      question: trimmedQuestion,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      answer: ans,
      source: safeSource,
    })
    .select("id, topic_id, question, option_a, option_b, option_c, option_d, answer, source")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { error } = await supabaseAdmin.from("questions").delete().not("id", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
