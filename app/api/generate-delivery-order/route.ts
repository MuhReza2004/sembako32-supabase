import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { formatRupiah } from "@/helper/format";
import * as fs from "fs/promises";
import * as path from "path";
import { requireAuth } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import { escapeHtml } from "@/helper/escapeHtml";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPuppeteerLaunchOptions } from "@/lib/puppeteer";

export const runtime = "nodejs";
export const maxDuration = 60;

type DOItem = {
  qty: number;
  harga?: number;
  subtotal?: number;
  supplier_produk?: {
    produk?: {
      nama?: string;
    };
  };
};

type DeliveryOrderPayload = {
  no_do: string;
  no_tanda_terima?: string;
  penjualan: {
    no_invoice?: string;
    no_npb?: string;
    tanggal: string;
    pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
    items?: DOItem[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;
    const { role, userId } = guard;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`pdf:delivery:${ip}`, 10, 60_000);
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

    const { deliveryOrder } = (await request.json()) as {
      deliveryOrder: DeliveryOrderPayload;
    };
    const safe = (value: string | number | null | undefined) =>
      escapeHtml(String(value ?? ""));

    if (role !== "admin") {
      if (!deliveryOrder?.no_do) {
        return NextResponse.json({ error: "missing_no_do" }, { status: 400 });
      }
      const { data: owned } = await supabaseAdmin
        .from("delivery_orders")
        .select("id, penjualan:penjualan_id(created_by)")
        .eq("no_do", deliveryOrder.no_do)
        .single();
      const createdBy = (
        owned as { penjualan?: { created_by?: string } } | null
      )?.penjualan?.created_by;
      if (!createdBy || createdBy !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
    if (!deliveryOrder?.no_do || !deliveryOrder?.penjualan) {
      return NextResponse.json(
        { error: "Missing required delivery order data" },
        { status: 400 },
      );
    }

    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = logoBuffer.toString("base64");
    const logoSrc = `data:image/svg+xml;base64,${logoBase64}`;

    const svgGradient = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fec335;" />
            <stop offset="100%" style="stop-color:#ffd966;" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `;
    const gradientBg = `data:image/svg+xml;base64,${Buffer.from(svgGradient).toString("base64")}`;

    const headerTemplate = `
      <div style="
        font-family: 'Open Sans', Arial, sans-serif;
        width: 100%;
        height: 100px;
        -webkit-print-color-adjust: exact;
        color: white;
      ">
        <div style="
          background-image: url('${gradientBg}');
          background-size: cover;
          border-radius: 8px;
          margin: 0 auto;
          width: 85%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
        ">
          <div style="display: flex; align-items: center; gap: 20px;">
            <img src="${logoSrc}" style="height: 55px; width: 55px; background: white; border-radius: 8px; padding: 6px;" />
            <div>
              <h1 style="font-size: 18px; color:#102853 ; margin: 0 0 10px 0; font-weight: 700; letter-spacing: 0.5px;">SEMBAKO 32</h1>
              <div style="font-size: 9px; line-height: 1.7; color: #000000; opacity: 0.95;">
                <div><strong style="display: inline-block; width: 45px;">Alamat</strong> : Jl. Soekarno Hatta Pasangkayu</div>
                <div><strong style="display: inline-block; width: 45px;">Kontak</strong> : 0821-9030-9333</div>
                <div><strong style="display: inline-block; width: 45px;">Email</strong> : sembako32@gmail.com</div>
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9px; color: #000000; opacity: 0.9;">
            <div style="margin-bottom: 4px; font-weight: 500;">Tanggal Cetak:</div>
            <div style="font-weight: 600; font-size: 10px;">${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>
      </div>
    `;

    const footerTemplate = `
      <div style="
        font-family: 'Open Sans', Arial, sans-serif;
        width: 100%;
        text-align: center;
        padding: 5px 20px;
        font-size: 8px;
        color: #6b7280;
        border-top: 1px solid #e5e7eb;
      ">
        Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span>
      </div>
    `;

    const items: DOItem[] = deliveryOrder.penjualan.items || [];
    const total = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Delivery Order ${deliveryOrder.no_do}</title>
          <style>
            body { font-family: 'Open Sans', Arial, sans-serif; margin: 20px; color: #111827; }
            h2 { color: #111827; text-align: center; margin: 0; }
            .meta { margin-top: 40px; display: grid; grid-template-columns: 160px 10px auto; row-gap: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background-color: #f9fafb; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2 style="text-decoration: underline;">DELIVERY ORDER</h2>
          <h4 style="text-align: center;">NO: ${safe(deliveryOrder.no_do)}</h4>
          <div class="meta">
          <span>No. NPB</span><span>:</span><span>${safe(deliveryOrder.penjualan.no_npb || "-")}</span>
          <span>No. Invoice</span><span>:</span><span>${safe(deliveryOrder.penjualan.no_invoice || "-")}</span>
            <span>Tanggal</span><span>:</span><span>${safe(new Date(deliveryOrder.penjualan.tanggal).toLocaleDateString("id-ID"))}</span>
            <span>Dikirim Ke</span><span>:</span><span>${safe(deliveryOrder.penjualan.pelanggan?.nama_pelanggan || "-")}</span>
            <span>Alamat</span><span>:</span><span>${safe(deliveryOrder.penjualan.pelanggan?.alamat || "-")}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Produk</th>
                <th>Qty</th>
                <th>Harga</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item: DOItem, index: number) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${safe(item.supplier_produk?.produk?.nama || "Produk")}</td>
                      <td>${safe(item.qty)}</td>
                      <td>${safe(formatRupiah(item.harga || 0))}</td>
                      <td>${safe(formatRupiah(item.subtotal || 0))}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top: 16px; text-align: right;">
            <p class="total">Total: ${safe(formatRupiah(total))}</p>
          </div>
        </body>
      </html>
    `;

    const launchOptions = await getPuppeteerLaunchOptions();
    const browser = await puppeteer.launch({
      ...launchOptions,
      timeout: 60000,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let pdfBuffer: Uint8Array;
    try {
      pdfBuffer = await page.pdf({
        format: "a4",
        printBackground: true,
        margin: {
          top: "140px",
          right: "20px",
          bottom: "80px",
          left: "20px",
        },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        preferCSSPageSize: true,
        timeout: 60000,
      });
    } finally {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }

    const filename = `delivery_order_${deliveryOrder.no_do}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating DO PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Gagal membuat PDF Delivery Order", details: errorMessage },
      { status: 500 },
    );
  }
}
