import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Subject } from "@/lib/types";

// Dữ liệu đổi bất cứ lúc nào admin sửa môn/chủ đề (Step 7) — không cho Next cache tĩnh.
export const dynamic = "force-dynamic";

interface SubjectRow {
  id: string;
  name: string;
  description: string | null;
}

interface TopicRow {
  id: string;
  subject_id: string;
  price: number | null;
  is_active: boolean;
}

export async function GET() {
  const { data: subjects, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("id, name, description")
    .returns<SubjectRow[]>();

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const { data: topics, error: topicsError } = await supabaseAdmin
    .from("topics")
    .select("id, subject_id, price, is_active")
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

  // "Mở bán/chơi được": chủ đề đang bật, đã định giá (kể cả 0đ = miễn phí), có ít nhất 1 câu hỏi.
  const sellableTopicCountBySubject = new Map<string, number>();
  for (const t of topics) {
    const questionCount = questionCountByTopic.get(t.id) ?? 0;
    const sellable = t.is_active && t.price !== null && questionCount > 0;
    if (sellable) {
      sellableTopicCountBySubject.set(
        t.subject_id,
        (sellableTopicCountBySubject.get(t.subject_id) ?? 0) + 1
      );
    }
  }

  const result: Subject[] = subjects
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      topicCount: sellableTopicCountBySubject.get(s.id) ?? 0,
    }))
    .filter((s) => s.topicCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return NextResponse.json(result);
}
