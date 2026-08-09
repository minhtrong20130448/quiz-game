import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Topic } from "@/lib/types";

// Dữ liệu đổi bất cứ lúc nào admin sửa chủ đề (Step 7) — không cho Next cache tĩnh.
export const dynamic = "force-dynamic";

interface TopicRow {
  id: string;
  name: string;
  price: number | null;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const subjectId = searchParams.get("subject_id");

  if (!subjectId) {
    return NextResponse.json({ error: "Thiếu subject_id" }, { status: 400 });
  }

  const { data: topics, error: topicsError } = await supabaseAdmin
    .from("topics")
    .select("id, name, price, is_active")
    .eq("subject_id", subjectId)
    .returns<TopicRow[]>();

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  const topicIds = topics.map((t) => t.id);
  const { data: questions, error: questionsError } = topicIds.length
    ? await supabaseAdmin
        .from("questions")
        .select("topic_id")
        .in("topic_id", topicIds)
        .returns<{ topic_id: string | null }[]>()
    : { data: [] as { topic_id: string | null }[], error: null };

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  const questionCountByTopic = new Map<string, number>();
  for (const q of questions) {
    if (!q.topic_id) continue;
    questionCountByTopic.set(q.topic_id, (questionCountByTopic.get(q.topic_id) ?? 0) + 1);
  }

  const result: Topic[] = topics
    .map((t) => {
      const questionCount = questionCountByTopic.get(t.id) ?? 0;
      return {
        id: t.id,
        name: t.name,
        price: t.price,
        questionCount,
        // price=0 vẫn "đã định giá" (miễn phí); price=null nghĩa là "Sắp có".
        sellable: t.is_active && t.price !== null && questionCount > 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return NextResponse.json(result);
}
