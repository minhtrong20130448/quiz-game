import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TopicCount } from "@/lib/types";

// Dữ liệu đổi bất cứ lúc nào admin import câu hỏi (Step 8) — không cho Next cache tĩnh.
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("topic")
    .returns<{ topic: string }[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.topic, (counts.get(row.topic) ?? 0) + 1);
  }

  const topics: TopicCount[] = Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => a.topic.localeCompare(b.topic, "vi"));

  return NextResponse.json(topics);
}
