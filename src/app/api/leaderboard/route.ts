import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_LEADERBOARD_LIMIT = 50;
// Khi unique=1: lấy dư một lượng lớn (đã sắp điểm cao trước) rồi lọc trùng username
// phía server, không cần view/RPC riêng cho việc này ở quy mô dự án nhỏ.
const UNIQUE_FETCH_POOL = 500;

function parseLimit(raw: string | null): number {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LEADERBOARD_LIMIT;
  }
  return Math.min(parsed, MAX_LEADERBOARD_LIMIT);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const topic = searchParams.get("topic");
  const unique = searchParams.get("unique") === "1";
  const limit = parseLimit(searchParams.get("limit"));

  let query = supabaseAdmin
    .from("scores")
    .select("username, topic, score, correct_count, total_questions, created_at")
    .order("score", { ascending: false })
    .order("correct_count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(unique ? UNIQUE_FETCH_POOL : limit);

  if (topic && topic !== "ALL") {
    query = query.eq("topic", topic);
  }

  const { data, error } = await query.returns<LeaderboardEntry[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!unique) {
    return NextResponse.json(data);
  }

  const seenUsernames = new Set<string>();
  const deduped: LeaderboardEntry[] = [];
  for (const row of data) {
    if (seenUsernames.has(row.username)) continue;
    seenUsernames.add(row.username);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }

  return NextResponse.json(deduped);
}
