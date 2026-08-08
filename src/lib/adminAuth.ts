import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Kiểm tra header "x-admin-password" so với ADMIN_PASSWORD.
 * Trả về NextResponse 401 nếu sai — dùng ở đầu mỗi API admin:
 *   const authError = verifyAdminPassword(request);
 *   if (authError) return authError;
 * Trả về null nếu hợp lệ.
 */
export function verifyAdminPassword(request: NextRequest): NextResponse | null {
  const password = request.headers.get("x-admin-password");

  if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
  }

  return null;
}
