import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);

interface ValidatedRow {
  topic: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: "A" | "B" | "C" | "D";
  source: string | null;
}

function validateRow(row: unknown, index: number): { row: ValidatedRow } | { error: string } {
  if (typeof row !== "object" || row === null) {
    return { error: `Dòng ${index + 1}: dữ liệu không hợp lệ.` };
  }

  const r = row as Record<string, unknown>;
  const topic = typeof r.topic === "string" ? r.topic.trim() : "";
  const question = typeof r.question === "string" ? r.question.trim() : "";
  const option_a = typeof r.option_a === "string" ? r.option_a.trim() : "";
  const option_b = typeof r.option_b === "string" ? r.option_b.trim() : "";
  const option_c = typeof r.option_c === "string" ? r.option_c.trim() : "";
  const option_d = typeof r.option_d === "string" ? r.option_d.trim() : "";
  const answer = typeof r.answer === "string" ? r.answer.trim().toUpperCase() : "";
  const source = typeof r.source === "string" && r.source.trim() ? r.source.trim() : null;

  if (!topic || !question || !option_a || !option_b || !option_c || !option_d) {
    return { error: `Dòng ${index + 1}: thiếu topic/question/phương án.` };
  }
  if (!VALID_ANSWERS.has(answer)) {
    return { error: `Dòng ${index + 1}: answer phải là A/B/C/D.` };
  }

  return {
    row: {
      topic,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      answer: answer as "A" | "B" | "C" | "D",
      source,
    },
  };
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

  const { mode, rows } = body as Record<string, unknown>;

  if (mode !== "replace" && mode !== "append") {
    return NextResponse.json({ error: "mode phải là 'replace' hoặc 'append'." }, { status: 400 });
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "rows phải là mảng." }, { status: 400 });
  }

  const validRows: ValidatedRow[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const result = validateRow(row, index);
    if ("error" in result) {
      errors.push(result.error);
    } else {
      validRows.push(result.row);
    }
  });

  // Không xoá dữ liệu cũ nếu không có gì hợp lệ để thay thế — tránh xoá sạch ngân
  // hàng câu hỏi vì lỡ import nhầm file rỗng/sai định dạng.
  if (mode === "replace" && validRows.length === 0) {
    return NextResponse.json(
      {
        inserted: 0,
        skipped: errors.length,
        errors: [...errors, "Không có dòng hợp lệ nào — đã huỷ thao tác thay thế, giữ nguyên dữ liệu cũ."],
      },
      { status: 400 },
    );
  }

  if (mode === "replace") {
    // PostgREST bắt buộc phải có điều kiện lọc khi DELETE — dùng "id is not null"
    // để khớp toàn bộ dòng (id là uuid PK, không bao giờ null).
    const { error: deleteError } = await supabaseAdmin.from("questions").delete().not("id", "is", null);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  if (validRows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("questions").insert(validRows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ inserted: validRows.length, skipped: errors.length, errors });
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
