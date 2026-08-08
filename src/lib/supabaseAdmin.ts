import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ CHỈ dùng trong API routes / Server Components (phía server).
 * Client này dùng SUPABASE_SERVICE_ROLE_KEY — bỏ qua Row Level Security,
 * có toàn quyền đọc/ghi DB. TUYỆT ĐỐI KHÔNG import file này vào bất kỳ
 * component nào có "use client" hoặc code chạy ở trình duyệt.
 * Import "server-only" ở trên sẽ làm build LỖI NGAY nếu lỡ import nhầm vào client bundle.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. Xem .env.local.example."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
