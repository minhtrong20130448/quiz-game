import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";
import type { AdminScoreEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const ADMIN_SCORES_LIMIT = 500;

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username");

  let query = supabaseAdmin
    .from("scores")
    .select("id, username, topic, score, correct_count, wrong_count, total_questions, wrong_details, created_at")
    .order("created_at", { ascending: false })
    .limit(ADMIN_SCORES_LIMIT);

  if (username && username.trim()) {
    query = query.ilike("username", `%${username.trim()}%`);
  }

  const { data, error } = await query.returns<AdminScoreEntry[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
