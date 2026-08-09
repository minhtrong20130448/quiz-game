import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Admin có thể đổi cài đặt bất cứ lúc nào (Step "Cài đặt" trong /admin) — không cache tĩnh.
export const dynamic = "force-dynamic";

interface AppSettingsRow {
  watermark_enabled: boolean;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("watermark_enabled")
    .eq("id", 1)
    .maybeSingle<AppSettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nếu vì lý do gì đó chưa có dòng cài đặt (chưa chạy migration/insert seed) thì mặc
  // định BẬT watermark — an toàn hơn là mặc định tắt bảo vệ.
  return NextResponse.json({ watermarkEnabled: data?.watermark_enabled ?? true });
}
