import { NextRequest, NextResponse } from "next/server";
import {
  guardPdfRequest,
  pdfError,
  pdfResponse,
  readJsonBody,
  stringField,
} from "@/lib/pdf/route-helpers";
import { PDFDocument } from "pdf-lib";
import {
  buildInvoiceOptions,
  loadPenjualanForPdf,
  toDeliveryOrderPdfData,
} from "@/lib/pdf/penjualan-data";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { renderDeliveryOrderPdf } from "@/lib/pdf/delivery-order";
import { renderReceiptPdf } from "@/lib/pdf/receipt";

export const runtime = "nodejs";
export const maxDuration = 60;

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

// Body: { penjualan_id: string }
// Menggabungkan invoice + delivery order (jika ada) + tanda terima.
// Render dipanggil langsung (tanpa HTTP ke route lain), sehingga cookie/token
// tidak pernah diteruskan ke URL lain.
export async function POST(request: NextRequest) {
  try {
    const guard = await guardPdfRequest(request, "documents", 5);
    if (!guard.ok) return guard.response;

    const body = await readJsonBody(request);
    const loaded = await loadPenjualanForPdf(
      stringField(body, "penjualan_id") || "",
      guard.auth,
    );
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    const penjualan = loaded.data;

    // Render berurutan: tiap render menjalankan satu instance Chromium.
    const docs: Buffer[] = [];
    docs.push(
      await renderInvoicePdf({
        ...penjualan,
        ...buildInvoiceOptions(penjualan, "invoice"),
      }),
    );
    if (penjualan.no_do) {
      docs.push(
        await renderDeliveryOrderPdf(
          toDeliveryOrderPdfData(penjualan, {
            no_do: penjualan.no_do,
            no_tanda_terima: penjualan.no_tanda_terima,
          }),
        ),
      );
    }
    docs.push(await renderReceiptPdf(penjualan));

    const merged = await PDFDocument.create();
    for (const buf of docs) {
      const pdf = await PDFDocument.load(buf);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const mergedBytes = await merged.save();

    const filename = `Laporan_${safeFileName(penjualan.namaPelanggan || penjualan.no_invoice || "dokumen")}.pdf`;
    return pdfResponse(mergedBytes, filename);
  } catch (error) {
    return pdfError("Failed to generate combined PDF", error);
  }
}
