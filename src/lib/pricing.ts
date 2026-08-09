export interface TopicDiscount {
  discountPercent: number | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
}

/** Giảm giá đang áp dụng khi: có % giảm hợp lệ (1-100), có đủ ngày bắt đầu/kết thúc,
 * và thời điểm hiện tại nằm trong khoảng đó (bao gồm cả 2 đầu mút). */
export function isDiscountActive(discount: TopicDiscount, now: Date = new Date()): boolean {
  if (discount.discountPercent === null || discount.discountPercent <= 0) return false;
  if (!discount.discountStartsAt || !discount.discountEndsAt) return false;

  const t = now.getTime();
  const start = new Date(discount.discountStartsAt).getTime();
  const end = new Date(discount.discountEndsAt).getTime();
  return t >= start && t <= end;
}

/** Giá thực tế phải trả — làm tròn tới đồng, không âm. */
export function computeFinalPrice(price: number, discountPercent: number | null): number {
  if (discountPercent === null || discountPercent <= 0) return price;
  return Math.max(0, Math.round((price * (100 - discountPercent)) / 100));
}
