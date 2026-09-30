import { NextRequest, NextResponse } from "next/server";
import {
  guardPdfRequest,
  pdfError,
  pdfResponse,
  readJsonBody,
  stringField,
} from "@/lib/pdf/route-helpers";
import { loadPenjualanForPdf } from "@/lib/pdf/penjualan-data";
import { renderReceiptPdf } from "@/lib/pdf/receipt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { penjualan_id: string }
export async function POST(request: NextRequest) {
  try {
    const guard = await guardPdfRequest(request, "receipt", 10);
    if (!guard.ok) return guard.response;

    const body = await readJsonBody(request);
    const loaded = await loadPenjualanForPdf(
      stringField(body, "penjualan_id") || "",
      guard.auth,
    );
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const pdf = await renderReceiptPdf(loaded.data);
    return pdfResponse(
      pdf,
      `tanda_terima_${loaded.data.no_tanda_terima || loaded.data.no_invoice}.pdf`,
    );
  } catch (error) {
    return pdfError("Gagal membuat PDF tanda terima", error);
  }
}
