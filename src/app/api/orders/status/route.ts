import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PENDING_EXPIRY_MINUTES = 15;

interface OrderRow {
  id: string;
  status: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "Thiếu orderId." }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, created_at")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
  }

  if (order.status === "pending") {
    const ageMinutes = (Date.now() - new Date(order.created_at).getTime()) / 60_000;
    if (ageMinutes > PENDING_EXPIRY_MINUTES) {
      // Chỉ đổi khi vẫn đang 'pending' — tránh ghi đè nếu webhook vừa xác nhận paid.
      await supabaseAdmin
        .from("orders")
        .update({ status: "expired" })
        .eq("id", order.id)
        .eq("status", "pending");
      return NextResponse.json({ status: "expired" });
    }
  }

  return NextResponse.json({ status: order.status });
}
