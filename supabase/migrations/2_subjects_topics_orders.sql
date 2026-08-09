-- =============================================================================
-- Nâng cấp: Môn học -> Chủ đề, đơn mua (vé chơi)
-- (Step 1 trong Plan/quiz-web-app-NANG-CAP-PLAN.md)
--
-- HƯỚNG DẪN CHẠY:
-- 1. Vào Supabase Dashboard của project -> mục "SQL Editor" (biểu tượng </>) -> "New query".
-- 2. Dán TOÀN BỘ nội dung file này vào -> bấm "Run".
-- 3. Kiểm tra ở mục "Table Editor": phải thấy thêm 3 bảng "subjects", "topics", "orders";
--    bảng "questions" có thêm cột topic_id; bảng "scores" có thêm topic_id, order_id.
--
-- File dùng IF NOT EXISTS / IF EXISTS nên chạy lại nhiều lần không lỗi.
-- Phần "DI TRÚ DỮ LIỆU CŨ" ở cuối file là TÙY CHỌN — chỉ chạy nếu bảng
-- questions đang có dữ liệu cũ dùng cột `topic` (text) và bạn muốn gán chúng
-- vào cấu trúc Môn học/Chủ đề mới trước khi bỏ cột `topic`.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Bảng "subjects" — môn học (cấp 1). Quản lý tay ở /admin (Step 7) hoặc tự
-- tạo qua import Excel (Step 8).
-- -----------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Bảng "topics" — chủ đề (cấp 2, thuộc 1 môn). price NULL = chưa định giá
-- (chưa bán được); price = 0 = miễn phí; is_active = false thì ẩn khỏi trang
-- chủ. Xem quy tắc "sellable" ở API /api/topics (Step 2).
-- -----------------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  price integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists topics_subject_id_idx on public.topics (subject_id);

-- -----------------------------------------------------------------------------
-- Bảng "questions" — thêm topic_id (thay cho cột `topic` text cũ, xem phần
-- di trú dữ liệu cũ ở cuối file).
-- -----------------------------------------------------------------------------
alter table public.questions
  add column if not exists topic_id uuid references public.topics (id) on delete cascade;

create index if not exists questions_topic_id_idx on public.questions (topic_id);

-- Cột `topic` (text) cũ không còn bắt buộc — câu hỏi mới chỉ cần topic_id. Bỏ NOT NULL
-- để không chặn insert; giữ lại cột này cho tới khi chạy xong phần di trú dữ liệu cũ.
-- An toàn khi chạy lại nhiều lần (no-op nếu đã nullable) — TRỪ khi cột `topic` đã bị
-- xoá hẳn qua lệnh "drop column" ở cuối file, lúc đó bỏ dòng dưới đi trước khi chạy lại.
alter table public.questions alter column topic drop not null;

-- -----------------------------------------------------------------------------
-- Bảng "orders" — 1 đơn = 1 vé chơi đúng 1 lượt cho 1 chủ đề. Vòng đời:
-- pending -> (SePay xác nhận, Step 4) paid -> (tiêu vé, Step 5) playing ->
-- (nộp kết quả) completed. Đơn 'pending' quá hạn coi như 'expired'.
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics (id),
  username text not null,
  amount integer not null,
  memo_code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'playing', 'completed', 'expired')),
  served_question_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  play_started_at timestamptz,
  completed_at timestamptz
);

create index if not exists orders_memo_code_idx on public.orders (memo_code);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at);

-- -----------------------------------------------------------------------------
-- Bảng "scores" — gắn thêm điểm với chủ đề & đơn đã mua.
-- -----------------------------------------------------------------------------
alter table public.scores
  add column if not exists topic_id uuid references public.topics (id);

alter table public.scores
  add column if not exists order_id uuid references public.orders (id);

-- -----------------------------------------------------------------------------
-- Row Level Security — bật RLS cho các bảng mới, KHÔNG tạo policy công khai
-- nào (giống questions/scores). Toàn bộ đọc/ghi đi qua supabaseAdmin (service
-- key) trong API routes phía server.
-- -----------------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.orders enable row level security;

-- =============================================================================
-- DI TRÚ DỮ LIỆU CŨ (TÙY CHỌN) — chỉ chạy nếu bảng questions đang có dữ liệu
-- dùng cột `topic` (text) từ trước khi nâng cấp, và bạn muốn giữ lại dữ liệu
-- đó dưới cấu trúc Môn học/Chủ đề mới.
--
-- Bỏ comment (xóa /* và */) rồi chạy đoạn dưới SAU KHI đã chạy xong phần
-- migration ở trên. Sau khi chạy xong và xác nhận topic_id đã được gán đầy
-- đủ, có thể bỏ cột `topic` cũ bằng:
--   alter table public.questions drop column if exists topic;
-- =============================================================================

/*
-- 1. Tạo môn mặc định "Chưa phân loại" để chứa các chủ đề cũ.
insert into public.subjects (name, description)
values ('Chưa phân loại', 'Môn học tạm sinh ra khi nâng cấp từ dữ liệu topic cũ')
on conflict (name) do nothing;

-- 2. Tạo 1 topic mới cho mỗi giá trị `topic` (text) khác nhau đang có trong
--    questions, gắn vào môn "Chưa phân loại" ở trên. price để NULL (chưa
--    định giá) — admin cần vào /admin đặt giá trước khi mở bán.
insert into public.topics (subject_id, name, price, is_active)
select
  (select id from public.subjects where name = 'Chưa phân loại'),
  q.topic,
  null,
  true
from (select distinct topic from public.questions where topic is not null) q
on conflict (subject_id, name) do nothing;

-- 3. Gán topic_id cho từng câu hỏi cũ dựa theo cột topic (text).
update public.questions q
set topic_id = t.id
from public.topics t
where t.subject_id = (select id from public.subjects where name = 'Chưa phân loại')
  and t.name = q.topic
  and q.topic_id is null;
*/
