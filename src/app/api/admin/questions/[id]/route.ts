import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);

const QUESTION_COLUMNS = "id, topic_id, question, option_a, option_b, option_c, option_d, answer, source";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/admin/questions/[id]">) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { id } = await ctx.params;

  const { data, error } = await supabaseAdmin.from("questions").select(QUESTION_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/questions/[id]">) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { id } = await ctx.params;

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

  const patch: Record<string, unknown> = {};

  if (topicId !== undefined) {
    if (typeof topicId !== "string" || !topicId) {
      return NextResponse.json({ error: "topicId không hợp lệ." }, { status: 400 });
    }
    patch.topic_id = topicId;
  }
  if (question !== undefined) {
    const trimmed = typeof question === "string" ? question.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "question không được để trống." }, { status: 400 });
    patch.question = trimmed;
  }
  for (const [key, field] of [
    ["option_a", option_a],
    ["option_b", option_b],
    ["option_c", option_c],
    ["option_d", option_d],
  ] as const) {
    if (field !== undefined) {
      const trimmed = typeof field === "string" ? field.trim() : "";
      if (!trimmed) return NextResponse.json({ error: `${key} không được để trống.` }, { status: 400 });
      patch[key] = trimmed;
    }
  }
  if (answer !== undefined) {
    const ans = typeof answer === "string" ? answer.trim().toUpperCase() : "";
    if (!VALID_ANSWERS.has(ans)) {
      return NextResponse.json({ error: "answer phải là A/B/C/D." }, { status: 400 });
    }
    patch.answer = ans;
  }
  if (source !== undefined) {
    patch.source = typeof source === "string" && source.trim() ? source.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("questions")
    .update(patch)
    .eq("id", id)
    .select(QUESTION_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/questions/[id]">) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { id } = await ctx.params;

  const { error } = await supabaseAdmin.from("questions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
