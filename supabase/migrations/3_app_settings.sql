-- =============================================================================
-- Cài đặt chung của app (bảng 1 dòng duy nhất — singleton), admin bật/tắt qua
-- trang /admin, mục "Cài đặt".
--
-- HƯỚNG DẪN CHẠY: giống các migration trước — dán vào Supabase SQL Editor → Run.
-- File dùng IF NOT EXISTS / ON CONFLICT nên chạy lại nhiều lần không lỗi.
-- =============================================================================

create table if not exists public.app_settings (
  id integer primary key default 1,
  watermark_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, watermark_enabled)
values (1, true)
on conflict (id) do nothing;

-- RLS bật, không tạo policy public — đọc/ghi qua supabaseAdmin (service key) ở server,
-- giống quy ước các bảng khác trong dự án.
alter table public.app_settings enable row level security;
