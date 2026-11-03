import { NextRequest, NextResponse } from "next/server";
import {
  guardPdfRequest,
  pdfError,
  pdfResponse,
  readJsonBody,
  stringField,
} from "@/lib/pdf/route-helpers";
import { loadDeliveryOrderForPdf } from "@/lib/pdf/penjualan-data";
import { renderDeliveryOrderPdf } from "@/lib/pdf/delivery-order";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { delivery_order_id: string } atau { penjualan_id: string }
export async function POST(request: NextRequest) {
  try {
    const guard = await guardPdfRequest(request, "delivery", 10);
    if (!guard.ok) return guard.response;

    const body = await readJsonBody(request);
    const loaded = await loadDeliveryOrderForPdf(
      {
        deliveryOrderId: stringField(body, "delivery_order_id"),
        penjualanId: stringField(body, "penjualan_id"),
      },
      guard.auth,
    );
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const pdf = await renderDeliveryOrderPdf(loaded.data);
    return pdfResponse(pdf, `delivery_order_${loaded.data.no_do}.pdf`);
  } catch (error) {
    return pdfError("Gagal membuat PDF Delivery Order", error);
  }
}
