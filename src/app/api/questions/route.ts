import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Question } from "@/lib/types";

// Dữ liệu đổi bất cứ lúc nào admin import câu hỏi (Step 8) — không cho Next cache tĩnh.
export const dynamic = "force-dynamic";

const QUESTION_COLUMNS =
  "id, topic, question, option_a, option_b, option_c, option_d, answer, source";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const topic = searchParams.get("topic");
  const limitParam = searchParams.get("limit");

  let query = supabaseAdmin.from("questions").select(QUESTION_COLUMNS);

  if (topic && topic !== "ALL") {
    query = query.eq("topic", topic);
  }

  const limit = limitParam ? Number(limitParam) : null;
  if (limit !== null && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query.returns<Question[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
