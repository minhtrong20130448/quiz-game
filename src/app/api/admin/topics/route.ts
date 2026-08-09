import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";
import { computeFinalPrice, isDiscountActive } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION_CODE = "23505";

interface TopicRow {
  id: string;
  subject_id: string;
  name: string;
  price: number | null;
  is_active: boolean;
  created_at: string;
  discount_percent: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
}

interface DiscountPatch {
  discount_percent: number | null;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
}

/**
 * 3 trường giảm giá luôn đi cùng nhau: không đụng gì -> undefined (giữ nguyên khi
 * PATCH); cả 3 null -> xoá giảm giá; đủ % (1-100) + 2 mốc ngày hợp lệ (bắt đầu <=
 * kết thúc) -> đặt giảm giá mới. Không cho thiếu 1 trong 3.
 */
function parseDiscountInput(
  body: Record<string, unknown>
): { ok: true; value: DiscountPatch | undefined } | { ok: false; error: string } {
  const { discountPercent, discountStartsAt, discountEndsAt } = body;
  const touched = discountPercent !== undefined || discountStartsAt !== undefined || discountEndsAt !== undefined;
  if (!touched) return { ok: true, value: undefined };

  if (discountPercent === null && discountStartsAt === null && discountEndsAt === null) {
    return { ok: true, value: { discount_percent: null, discount_starts_at: null, discount_ends_at: null } };
  }

  if (typeof discountPercent !== "number" || !Number.isInteger(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return { ok: false, error: "% giảm giá phải là số nguyên 1-100." };
  }
  if (typeof discountStartsAt !== "string" || typeof discountEndsAt !== "string") {
    return { ok: false, error: "Cần đủ ngày bắt đầu và ngày kết thúc giảm giá (hoặc để cả 3 trường trống để xoá giảm giá)." };
  }
  const start = new Date(discountStartsAt);
  const end = new Date(discountEndsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Ngày giảm giá không hợp lệ." };
  }
  if (start.getTime() > end.getTime()) {
    return { ok: false, error: "Ngày bắt đầu giảm giá phải trước hoặc bằng ngày kết thúc." };
  }

  return {
    ok: true,
    value: {
      discount_percent: discountPercent,
      discount_starts_at: start.toISOString(),
      discount_ends_at: end.toISOString(),
    },
  };
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

  return topics.map((t) => {
    const discount = {
      discountPercent: t.discount_percent,
      discountStartsAt: t.discount_starts_at,
      discountEndsAt: t.discount_ends_at,
    };
    const discountActive = t.price !== null && isDiscountActive(discount);

    return {
      id: t.id,
      subjectId: t.subject_id,
      name: t.name,
      price: t.price,
      finalPrice: t.price === null ? null : computeFinalPrice(t.price, discountActive ? t.discount_percent : null),
      discountPercent: t.discount_percent,
      discountStartsAt: t.discount_starts_at,
      discountEndsAt: t.discount_ends_at,
      discountActive,
      isActive: t.is_active,
      createdAt: t.created_at,
      questionCount: countByTopic.get(t.id) ?? 0,
    };
  });
}

const TOPIC_COLUMNS = "id, subject_id, name, price, is_active, created_at, discount_percent, discount_starts_at, discount_ends_at";

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const subjectId = request.nextUrl.searchParams.get("subject_id");

  let query = supabaseAdmin.from("topics").select(TOPIC_COLUMNS).order("name", { ascending: true });
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

  const bodyRecord = body as Record<string, unknown>;
  const { subjectId, name, price, isActive } = bodyRecord;
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

  const discountResult = parseDiscountInput(bodyRecord);
  if (!discountResult.ok) {
    return NextResponse.json({ error: discountResult.error }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("topics")
    .insert({
      subject_id: subjectId,
      name: trimmedName,
      price: price === undefined ? null : price,
      is_active: isActive === undefined ? true : Boolean(isActive),
      discount_percent: discountResult.value?.discount_percent ?? null,
      discount_starts_at: discountResult.value?.discount_starts_at ?? null,
      discount_ends_at: discountResult.value?.discount_ends_at ?? null,
    })
    .select(TOPIC_COLUMNS)
    .single<TopicRow>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Môn này đã có chủ đề trùng tên." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [withCount] = await withQuestionCounts([data]);
  return NextResponse.json(withCount, { status: 201 });
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

  const bodyRecord = body as Record<string, unknown>;
  const { id, name, price, isActive, subjectId } = bodyRecord;
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

  const discountResult = parseDiscountInput(bodyRecord);
  if (!discountResult.ok) {
    return NextResponse.json({ error: discountResult.error }, { status: 400 });
  }
  if (discountResult.value) {
    Object.assign(patch, discountResult.value);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("topics")
    .update(patch)
    .eq("id", id)
    .select(TOPIC_COLUMNS)
    .maybeSingle<TopicRow>();

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
