import { NextRequest } from "next/server";
import { handleOrderPayment, orderPaymentOptions } from "@/lib/order-payments";

// POST /api/tenant/menu-orders/[id]/payments — cobra cualquier pedido
// (mesa, pickup o delivery). La lógica vive en lib/order-payments.ts.
export const OPTIONS = orderPaymentOptions;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleOrderPayment(req, params.id);
}
