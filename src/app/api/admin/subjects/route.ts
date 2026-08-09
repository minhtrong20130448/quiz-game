import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION_CODE = "23505";

interface SubjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { data: subjects, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("id, name, description, created_at")
    .order("name", { ascending: true })
    .returns<SubjectRow[]>();

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const { data: topics, error: topicsError } = await supabaseAdmin
    .from("topics")
    .select("subject_id")
    .returns<{ subject_id: string }[]>();

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  const topicCountBySubject = new Map<string, number>();
  for (const t of topics) {
    topicCountBySubject.set(t.subject_id, (topicCountBySubject.get(t.subject_id) ?? 0) + 1);
  }

  const result = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    createdAt: s.created_at,
    topicCount: topicCountBySubject.get(s.id) ?? 0,
  }));

  return NextResponse.json(result);
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

  const { name, description } = body as Record<string, unknown>;
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return NextResponse.json({ error: "Thiếu tên môn học." }, { status: 400 });
  }
  const safeDescription = typeof description === "string" && description.trim() ? description.trim() : null;

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({ name: trimmedName, description: safeDescription })
    .select("id, name, description, created_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Tên môn học đã tồn tại." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id: data.id, name: data.name, description: data.description, createdAt: data.created_at, topicCount: 0 },
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

  const { id, name, description } = body as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Tên môn học không được để trống." }, { status: 400 });
    }
    patch.name = trimmedName;
  }
  if (description !== undefined) {
    patch.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Tên môn học đã tồn tại." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy môn học." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  // Xoá môn -> cascade xoá luôn topics & questions thuộc môn (ON DELETE CASCADE ở DB).
  const { error } = await supabaseAdmin.from("subjects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
