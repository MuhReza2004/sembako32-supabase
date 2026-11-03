import { NextRequest, NextResponse } from "next/server";
import {
  guardPdfRequest,
  pdfError,
  pdfResponse,
  readJsonBody,
  stringField,
} from "@/lib/pdf/route-helpers";
import { loadDeliveryOrderForPdf } from "@/lib/pdf/penjualan-data";
import { renderBastPdf } from "@/lib/pdf/bast";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { delivery_order_id: string } atau { penjualan_id: string }
export async function POST(request: NextRequest) {
  try {
    const guard = await guardPdfRequest(request, "bast", 10);
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

    const pdf = await renderBastPdf(loaded.data);
    return pdfResponse(pdf, `bast_${loaded.data.no_do}.pdf`);
  } catch (error) {
    return pdfError("Gagal membuat PDF Berita Acara", error);
  }
}
