-- =============================================================================
-- Giảm giá theo % + khoảng thời gian áp dụng cho từng chủ đề (admin cấu hình ở
-- /admin, mục "Môn học / Chủ đề").
--
-- discount_percent NULL hoặc <= 0        -> không giảm giá.
-- discount_starts_at / discount_ends_at  -> giảm giá chỉ có hiệu lực trong khoảng
--                                            này (đủ cả 2 mốc); thiếu 1 trong 2 coi
--                                            như chưa bật giảm giá.
--
-- HƯỚNG DẪN CHẠY: dán vào Supabase SQL Editor → Run. An toàn khi chạy lại nhiều lần.
-- =============================================================================

alter table public.topics
  add column if not exists discount_percent integer,
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz;
