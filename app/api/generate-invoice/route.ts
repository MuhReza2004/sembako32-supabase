import { NextRequest, NextResponse } from "next/server";
import {
  guardPdfRequest,
  pdfError,
  pdfResponse,
  readJsonBody,
  stringField,
} from "@/lib/pdf/route-helpers";
import {
  buildInvoiceOptions,
  loadPenjualanForPdf,
} from "@/lib/pdf/penjualan-data";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { penjualan_id: string, variant?: "invoice" | "pembayaran" }
// Seluruh isi invoice diambil dari database.
export async function POST(request: NextRequest) {
  try {
    const guard = await guardPdfRequest(request, "invoice", 10);
    if (!guard.ok) return guard.response;

    const body = await readJsonBody(request);
    const loaded = await loadPenjualanForPdf(
      stringField(body, "penjualan_id") || "",
      guard.auth,
    );
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const variant = body.variant === "pembayaran" ? "pembayaran" : "invoice";
    const pdf = await renderInvoicePdf({
      ...loaded.data,
      ...buildInvoiceOptions(loaded.data, variant),
    });

    return pdfResponse(pdf, `Invoice_${loaded.data.no_invoice}.pdf`);
  } catch (error) {
    return pdfError("Failed to generate PDF", error);
  }
}
