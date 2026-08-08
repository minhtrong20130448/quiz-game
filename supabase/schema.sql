-- =============================================================================
-- Quiz Game — Schema khởi tạo (Step 2 trong Plan/quiz-web-app-PLAN.md)
--
-- HƯỚNG DẪN CHẠY:
-- 1. Vào Supabase Dashboard của project → mục "SQL Editor" (biểu tượng </>) → "New query".
-- 2. Dán TOÀN BỘ nội dung file này vào → bấm "Run".
-- 3. Kiểm tra ở mục "Table Editor": phải thấy 2 bảng "questions" và "scores".
--
-- File dùng IF NOT EXISTS nên chạy lại nhiều lần không lỗi, nhưng đây là thao
-- tác tạo schema — không cần chạy lại sau khi đã tạo xong, trừ khi cố ý.
-- =============================================================================

-- Đảm bảo gen_random_uuid() khả dụng (PostgreSQL 13+ có sẵn; bật pgcrypto để
-- tương thích ngược nếu project dùng bản cũ hơn).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Bảng "questions" — ngân hàng câu hỏi. Admin nạp qua trang /admin (import từ
-- Excel ở Step 8); người chơi đọc qua GET /api/questions (Step 3).
-- -----------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  answer text not null check (answer in ('A', 'B', 'C', 'D')),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists questions_topic_idx on public.questions (topic);

-- -----------------------------------------------------------------------------
-- Bảng "scores" — mỗi dòng là 1 lượt chơi đã hoàn thành (ghi ở Step 7 khi
-- người chơi xem trang /result), dùng cho /leaderboard và /admin.
-- -----------------------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  topic text not null default 'ALL',
  score integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  total_questions integer not null default 0,
  wrong_details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (score desc);
create index if not exists scores_username_idx on public.scores (username);

-- -----------------------------------------------------------------------------
-- Row Level Security — bật RLS nhưng KHÔNG tạo policy công khai nào.
-- Toàn bộ đọc/ghi đi qua src/lib/supabaseAdmin.ts (service_role key) trong API
-- routes phía server — service_role mặc định BỎ QUA RLS nên vẫn hoạt động bình
-- thường. Vì không có policy nào cho anon/authenticated, client-side (nếu lỡ
-- dùng anon key) sẽ không đọc/ghi được gì — đúng ý đồ bảo mật của Plan.
-- -----------------------------------------------------------------------------
alter table public.questions enable row level security;
alter table public.scores enable row level security;
