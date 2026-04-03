import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { requireAuth } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import { Penjualan } from "@/app/types/penjualan";

export const runtime = "nodejs";
export const maxDuration = 60;

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`pdf:documents:${ip}`, 5, 60_000);
    if (!limit.ok) {
      const retryAfter = Math.max(
        1,
        Math.ceil((limit.resetAt - Date.now()) / 1000),
      );
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const penjualan = (await request.json()) as Penjualan & {
      nama_toko?: string;
      no_telp?: string;
      nama_pelanggan?: string;
      watermarkText?: string;
      invoiceTitle?: string;
      amountLabel?: string;
      amountValue?: number;
    };

    if (!penjualan?.no_invoice || !penjualan?.items) {
      return NextResponse.json(
        { error: "Missing required fields: no_invoice or items" },
        { status: 400 },
      );
    }

    const requestUrl = new URL(request.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      requestUrl.origin ||
      "http://localhost:3000";

    const authHeader = request.headers.get("authorization") || "";
    const cookieHeader = request.headers.get("cookie") || "";

    const commonHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) commonHeaders.Authorization = authHeader;
    if (cookieHeader) commonHeaders.Cookie = cookieHeader;

    const invoiceResp = await fetch(new URL("/api/generate-invoice", baseUrl).toString(), {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify(penjualan),
    });
    if (!invoiceResp.ok) {
      const err = await invoiceResp.text();
      throw new Error(`Failed to generate invoice: ${err}`);
    }
    const invoiceBuf = Buffer.from(await invoiceResp.arrayBuffer());

    let doBuf: Buffer | null = null;
    if (penjualan.no_do) {
      const doPayload = {
        deliveryOrder: {
          no_do: penjualan.no_do,
          no_tanda_terima: penjualan.no_tanda_terima,
          penjualan: {
            no_invoice: penjualan.no_invoice,
            no_npb: penjualan.no_npb,
            tanggal: penjualan.tanggal,
            pelanggan: {
              nama_pelanggan:
                penjualan.namaPelanggan || penjualan.nama_pelanggan || "",
              alamat: penjualan.alamatPelanggan || "",
            },
            items: (penjualan.items || []).map((item) => ({
              qty: item.qty,
              harga: item.hargaJual || item.harga || 0,
              subtotal: item.subtotal || 0,
              satuan: item.satuan || undefined,
              supplier_produk: {
                produk: {
                  nama: item.namaProduk || "Produk",
                  satuan: item.satuan || undefined,
                },
              },
            })),
          },
        },
      };

      const doResp = await fetch(new URL("/api/generate-delivery-order", baseUrl).toString(), {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(doPayload),
      });
      if (!doResp.ok) {
        const err = await doResp.text();
        throw new Error(`Failed to generate delivery order: ${err}`);
      }
      doBuf = Buffer.from(await doResp.arrayBuffer());
    }

    const receiptPayload = {
      ...penjualan,
      nama_pelanggan:
        penjualan.nama_pelanggan || penjualan.namaPelanggan || "",
      nama_toko: penjualan.nama_toko || "",
    };
    const receiptResp = await fetch(new URL("/api/generate-receipt", baseUrl).toString(), {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify(receiptPayload),
    });
    if (!receiptResp.ok) {
      const err = await receiptResp.text();
      throw new Error(`Failed to generate receipt: ${err}`);
    }
    const receiptBuf = Buffer.from(await receiptResp.arrayBuffer());

    const merged = await PDFDocument.create();
    const docs = [invoiceBuf, doBuf, receiptBuf].filter(
      (d): d is Buffer => !!d,
    );
    for (const buf of docs) {
      const pdf = await PDFDocument.load(buf);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const mergedBytes = await merged.save();

    const nameSource =
      penjualan.namaPelanggan ||
      penjualan.nama_pelanggan ||
      penjualan.no_invoice ||
      "dokumen";
    const filename = `Laporan_${safeFileName(nameSource)}.pdf`;

    return new NextResponse(new Uint8Array(mergedBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate combined PDF", details: errorMessage },
      { status: 500 },
    );
  }
}
