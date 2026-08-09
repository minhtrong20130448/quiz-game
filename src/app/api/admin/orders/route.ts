import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const ADMIN_ORDERS_LIMIT = 500;
const VALID_STATUSES = new Set(["pending", "paid", "playing", "completed", "expired"]);

interface OrderJoinRow {
  id: string;
  username: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
  topics: { name: string; subject_id: string; subjects: { name: string } | null } | null;
}

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const subjectId = searchParams.get("subject_id");
  const topicId = searchParams.get("topic_id");
  const username = searchParams.get("username");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "status không hợp lệ." }, { status: 400 });
  }

  // orders không có cột subject_id trực tiếp -> lọc theo môn bằng cách tìm trước các
  // topic_id thuộc môn đó, rồi lọc orders.topic_id IN (...).
  let subjectTopicIds: string[] | null = null;
  if (subjectId) {
    const { data: subjectTopics, error: topicsError } = await supabaseAdmin
      .from("topics")
      .select("id")
      .eq("subject_id", subjectId)
      .returns<{ id: string }[]>();
    if (topicsError) {
      return NextResponse.json({ error: topicsError.message }, { status: 500 });
    }
    subjectTopicIds = subjectTopics.map((t) => t.id);
    if (subjectTopicIds.length === 0) {
      return NextResponse.json([]);
    }
  }

  let query = supabaseAdmin
    .from("orders")
    .select(
      "id, username, amount, status, created_at, paid_at, completed_at, topic_id, topics ( name, subject_id, subjects ( name ) )"
    )
    .order("created_at", { ascending: false })
    .limit(ADMIN_ORDERS_LIMIT);

  if (status) query = query.eq("status", status);
  if (topicId) query = query.eq("topic_id", topicId);
  else if (subjectTopicIds) query = query.in("topic_id", subjectTopicIds);
  if (username && username.trim()) query = query.ilike("username", `%${username.trim()}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query.returns<OrderJoinRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data.map((row) => ({
    id: row.id,
    username: row.username,
    subject: row.topics?.subjects?.name ?? "?",
    topic: row.topics?.name ?? "?",
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    completedAt: row.completed_at,
  }));

  return NextResponse.json(result);
}
