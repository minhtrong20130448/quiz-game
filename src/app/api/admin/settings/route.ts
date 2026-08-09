import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

interface AppSettingsRow {
  watermark_enabled: boolean;
}

export async function GET(request: NextRequest) {
  const authError = verifyAdminPassword(request);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("watermark_enabled")
    .eq("id", 1)
    .maybeSingle<AppSettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watermarkEnabled: data?.watermark_enabled ?? true });
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

  const { watermarkEnabled } = body as Record<string, unknown>;
  if (typeof watermarkEnabled !== "boolean") {
    return NextResponse.json({ error: "watermarkEnabled phải là boolean." }, { status: 400 });
  }

  // upsert vào dòng singleton (id=1) — tự tạo nếu vì lý do gì đó chưa có sẵn.
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ id: 1, watermark_enabled: watermarkEnabled, updated_at: new Date().toISOString() })
    .select("watermark_enabled")
    .single<AppSettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watermarkEnabled: data.watermark_enabled });
}
