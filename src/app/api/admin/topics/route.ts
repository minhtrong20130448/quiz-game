import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION_CODE = "23505";

interface TopicRow {
  id: string;
  subject_id: string;
  name: string;
  price: number | null;
  is_active: boolean;
  created_at: string;
}

async function withQuestionCounts(topics: TopicRow[]) {
  const topicIds = topics.map((t) => t.id);
  const { data: questions, error } = topicIds.length
    ? await supabaseAdmin
        .from("questions")
        .select("topic_id")
        .in("topic_id", topicIds)
        .returns<{ topic_id: string | null }[]>()
    : { data: [] as { topic_id: string | null }[], error: null };

  if (error) throw error;

  const countByTopic = new Map<string, number>();
  for (const q of questions) {
    if (!q.topic_id) continue;
    countByTopic.set(q.topic_id, (countByTopic.get(q.topic_id) ?? 0) + 1);
  }

  return topics.map((t) => ({
    id: t.id,
    subjectId: t.subject_id,
    name: t.name,
    price: t.price,
    isActive: t.is_active,
    createdAt: t.created_at,
    questionCount: countByTopic.get(t.id) ?? 0,
  }));
}

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const subjectId = request.nextUrl.searchParams.get("subject_id");

  let query = supabaseAdmin
    .from("topics")
    .select("id, subject_id, name, price, is_active, created_at")
    .order("name", { ascending: true });
  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data: topics, error } = await query.returns<TopicRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    return NextResponse.json(await withQuestionCounts(topics));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const { subjectId, name, price, isActive } = body as Record<string, unknown>;
  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (typeof subjectId !== "string" || !subjectId) {
    return NextResponse.json({ error: "Thiếu subjectId." }, { status: 400 });
  }
  if (!trimmedName) {
    return NextResponse.json({ error: "Thiếu tên chủ đề." }, { status: 400 });
  }
  if (price !== null && price !== undefined && (typeof price !== "number" || price < 0 || !Number.isInteger(price))) {
    return NextResponse.json({ error: "Giá phải là số nguyên >= 0 hoặc để trống." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("topics")
    .insert({
      subject_id: subjectId,
      name: trimmedName,
      price: price === undefined ? null : price,
      is_active: isActive === undefined ? true : Boolean(isActive),
    })
    .select("id, subject_id, name, price, is_active, created_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Môn này đã có chủ đề trùng tên." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.id,
      subjectId: data.subject_id,
      name: data.name,
      price: data.price,
      isActive: data.is_active,
      createdAt: data.created_at,
      questionCount: 0,
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
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

  const { id, name, price, isActive, subjectId } = body as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Tên chủ đề không được để trống." }, { status: 400 });
    }
    patch.name = trimmedName;
  }
  if (price !== undefined) {
    if (price !== null && (typeof price !== "number" || price < 0 || !Number.isInteger(price))) {
      return NextResponse.json({ error: "Giá phải là số nguyên >= 0 hoặc null." }, { status: 400 });
    }
    patch.price = price;
  }
  if (isActive !== undefined) {
    patch.is_active = Boolean(isActive);
  }
  if (subjectId !== undefined) {
    if (typeof subjectId !== "string" || !subjectId) {
      return NextResponse.json({ error: "subjectId không hợp lệ." }, { status: 400 });
    }
    patch.subject_id = subjectId;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("topics")
    .update(patch)
    .eq("id", id)
    .select("id, subject_id, name, price, is_active, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Môn này đã có chủ đề trùng tên." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy chủ đề." }, { status: 404 });
  }

  try {
    const [withCount] = await withQuestionCounts([data]);
    return NextResponse.json(withCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  // Xoá chủ đề -> cascade xoá luôn questions thuộc chủ đề (ON DELETE CASCADE ở DB).
  const { error } = await supabaseAdmin.from("topics").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
