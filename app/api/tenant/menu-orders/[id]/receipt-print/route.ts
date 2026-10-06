import { NextRequest } from "next/server";
import { handleReceiptReprint, orderPaymentOptions } from "@/lib/order-payments";

// POST /api/tenant/menu-orders/[id]/receipt-print — reimprime el recibo
// de un pedido ya pagado (lo deja en cola; el Print Bridge lo saca).
export const OPTIONS = orderPaymentOptions;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleReceiptReprint(params.id);
}
