import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";
import { formatRupiah } from "@/helper/format";
import * as fs from "fs/promises";
import * as path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Pembelian } from "@/app/types/pembelian";
import { requireAdmin } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import { escapeHtml } from "@/helper/escapeHtml";

type PembelianDetailRow = {
  id: string;
  pembelian_id: string;
  supplier_produk_id: string;
  qty: number;
  harga: number;
  subtotal: number;
  created_at: string;
  supplier_produk?: {
    produk?: { nama?: string; satuan?: string };
  };
};

type PembelianRow = Pembelian & {
  supplier?: { nama?: string } | null;
  items?: PembelianDetailRow[];
};

// This function is for server-side use with admin privileges
const getAllPembelianAdmin = async (): Promise<Pembelian[]> => {
  const { data, error } = await supabaseAdmin
    .from("pembelian")
    .select(
      `
      *,
      supplier:supplier_id(nama),
      items:pembelian_detail(
        id, qty, harga, subtotal,
        supplier_produk:supplier_produk_id(
          id,
          produk:produk_id(nama, satuan)
        )
      )
    `,
    )
    .order("tanggal", { ascending: false });

  if (error) {
    console.error("Error fetching purchase data for report:", error);
    throw error;
  }

  const pembelianList: Pembelian[] = (data as PembelianRow[]).map(
    (item: PembelianRow) => ({
      id: item.id,
      supplier_id: item.supplier_id,
      tanggal: item.tanggal,
      no_do: item.no_do,
      no_npb: item.no_npb,
      invoice: item.invoice,
      metode_pembayaran: item.metode_pembayaran || "Tunai",
      nama_bank: item.nama_bank || undefined,
      nama_pemilik_rekening: item.nama_pemilik_rekening || undefined,
      nomor_rekening: item.nomor_rekening || undefined,
      total: item.total,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      namaSupplier: item.supplier?.nama || "Supplier Tidak Diketahui",
      items: (item.items || []).map((detail: PembelianDetailRow) => ({
        id: detail.id,
        pembelian_id: detail.pembelian_id,
        supplier_produk_id: detail.supplier_produk_id,
        qty: detail.qty,
        harga: detail.harga,
        subtotal: detail.subtotal,
        created_at: detail.created_at,
        namaProduk:
          detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
        satuan: detail.supplier_produk?.produk?.satuan || "",
      })),
    }),
  );

  return pembelianList;
};

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if (!guard.ok) return guard.response;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`pdf:purchase:${ip}`, 10, 60_000);
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

    const { startDate, endDate, pembelianId } = await request.json();
    const safe = (value: string | number | null | undefined) =>
      escapeHtml(String(value ?? ""));
    const periodLabel = pembelianId
      ? "Detail Pembelian"
      : startDate && endDate
        ? new Date(startDate).toLocaleDateString("id-ID") +
          " - " +
          new Date(endDate).toLocaleDateString("id-ID")
        : startDate
          ? "Dari: " + new Date(startDate).toLocaleDateString("id-ID")
          : endDate
            ? "Sampai: " + new Date(endDate).toLocaleDateString("id-ID")
            : "Semua Periode";

    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = logoBuffer.toString("base64");
    const logoSrc = `data:image/svg+xml;base64,${logoBase64}`;

    const allPurchases = await getAllPembelianAdmin();

    let filteredPurchases = allPurchases;
    if (pembelianId) {
      filteredPurchases = filteredPurchases.filter((p) => p.id === pembelianId);
    }
    if (startDate) {
      filteredPurchases = filteredPurchases.filter(
        (p) => new Date(p.tanggal) >= new Date(startDate),
      );
    }
    if (endDate) {
      filteredPurchases = filteredPurchases.filter(
        (p) => new Date(p.tanggal) <= new Date(endDate),
      );
    }

    const totalPurchases = filteredPurchases.length;
    const totalCost = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
    const paidPurchases = filteredPurchases.filter(
      (p) => p.status === "Completed",
    ).length;
    const unpaidPurchases = filteredPurchases.filter(
      (p) => p.status === "Pending" || p.status === "Decline",
    ).length;

    const renderListTable = () => `
          <table>
            <thead>
              <tr>
                <th class="nowrap">No</th>
                <th class="nowrap">Tanggal</th>
                <th>No Dokumen</th>
                <th>Supplier</th>
                <th class="num">Total</th>
                <th class="nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPurchases
                .map(
                  (p, index) => `
                    <tr>
                      <td class="nowrap">${index + 1}</td>
                      <td class="nowrap">${safe(new Date(p.tanggal).toLocaleDateString("id-ID"))}</td>
                      <td>
                        <ul class="doc-list">
                          <li>No NPB: ${safe(p.no_npb || "-")}</li>
                          <li>No DO: ${safe(p.no_do || "-")}</li>
                          <li>Invoice: ${safe(p.invoice || "-")}</li>
                        </ul>
                      </td>
                      <td>${safe(p.namaSupplier || "-")}</td>
                      <td class="num">${safe(formatRupiah(Number(p.total) || 0))}</td>
                      <td class="nowrap">${safe(p.status === "Completed" ? "Lunas" : p.status === "Pending" ? "Pending" : "Decline")}</td>
                    </tr>
                    <tr>
                      <td></td>
                      <td colspan="5">
                        <div class="detail-wrap">
                          <div class="detail-title">Detail Pembelian</div>
                          <table class="detail-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                              <tr>
                                <th>Produk</th>
                                <th class="num">Qty</th>
                                <th>Metode Pembayaran</th>
                                <th class="num">Harga</th>
                                <th class="num">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${(p.items || [])
                                .map(
                                  (item) => `
                                    <tr>
                                      <td>${safe(item.namaProduk || "-")}</td>
                                      <td class="num">${safe(item.qty ?? 0)}</td>
                                      <td>
                                        ${safe(p.metode_pembayaran || "-")}
                                        ${
                                          p.metode_pembayaran === "Transfer"
                                            ? `<div style="margin-top: 4px; font-size: 10px; color: #555;">
                                                <div>Bank: ${safe(p.nama_bank || "-")}</div>
                                                <div>Rek: ${safe(p.nomor_rekening || "-")}</div>
                                                <div>Atas Nama: ${safe(p.nama_pemilik_rekening || "-")}</div>
                                              </div>`
                                            : ""
                                        }
                                      </td>
                                      <td class="num">${safe(formatRupiah(Number(item.harga) || 0))}</td>
                                      <td class="num">${safe(formatRupiah(Number(item.subtotal) || 0))}</td>
                                    </tr>
                                  `,
                                )
                                .join("")}
                            </tbody>
                          </table>
                          <div class="detail-total">
                            <span>Total Transaksi</span>
                            <span>${safe(formatRupiah(Number(p.total) || 0))}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr class="spacer-row"><td colspan="6"></td></tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
    `;

    const renderDetailOnly = () => `
          ${filteredPurchases
            .map(
              (p, index) => `
                <div style="margin-bottom: 14px;">
                  <div class="detail-title">Detail Pembelian ${index + 1}</div>
                  <div class="meta">
                    <div>No NPB: ${safe(p.no_npb || "-")}</div>
                    <div>No DO: ${safe(p.no_do || "-")}</div>
                    <div>Invoice: ${safe(p.invoice || "-")}</div>
                  </div>
                  <table class="detail-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th class="num">Qty</th>
                        <th>Metode Pembayaran</th>
                        <th class="num">Harga</th>
                        <th class="num">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(p.items || [])
                        .map(
                          (item) => `
                            <tr>
                              <td>${safe(item.namaProduk || "-")}</td>
                              <td class="num">${safe(item.qty ?? 0)}</td>
                              <td>
                                ${safe(p.metode_pembayaran || "-")}
                                ${
                                  p.metode_pembayaran === "Transfer"
                                    ? `<div style="margin-top: 4px; font-size: 10px; color: #555;">
                                        <div>Bank: ${safe(p.nama_bank || "-")}</div>
                                        <div>Rek: ${safe(p.nomor_rekening || "-")}</div>
                                        <div>Atas Nama: ${safe(p.nama_pemilik_rekening || "-")}</div>
                                      </div>`
                                    : ""
                                }
                              </td>
                              <td class="num">${safe(formatRupiah(Number(item.harga) || 0))}</td>
                              <td class="num">${safe(formatRupiah(Number(item.subtotal) || 0))}</td>
                            </tr>
                          `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                  <div class="detail-total">
                    <span>Total Transaksi</span>
                    <span>${safe(formatRupiah(Number(p.total) || 0))}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Laporan Pembelian</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
            h2 { color: #333; text-align: center; margin-bottom: 8px; }
            .meta { margin: 12px 0 16px; font-size: 12px; color: #444; }
            .summary { margin-bottom: 16px; }
            .summary-grid { display: grid; grid-template-columns: 180px 10px auto; gap: 6px 8px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .total { font-weight: bold; }
            .doc-list { margin: 0; padding-left: 16px; }
            .detail-wrap { padding: 8px 0 4px; }
            .detail-title { font-weight: 600; margin-bottom: 6px; }
            .detail-table th, .detail-table td { font-size: 11px; padding: 5px 6px; }
            .detail-total { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; font-weight: 600; }
            .num { text-align: right; white-space: nowrap; }
            .nowrap { white-space: nowrap; }
            .spacer-row td { border: none; padding: 0; height: 6px; }
          </style>
        </head>
        <body>
          <h2>Laporan Pembelian</h2>
          ${
            pembelianId
              ? `${renderDetailOnly()}`
              : `<div class="meta">Periode: ${safe(periodLabel)}</div>
          <div class="summary">
            <div class="summary-grid">
              <span>Total Pembelian</span><span>:</span><span>${safe(totalPurchases)}</span>
              <span>Total Dibayar</span><span>:</span><span>${safe(paidPurchases)}</span>
              <span>Total Belum Dibayar</span><span>:</span><span>${safe(unpaidPurchases)}</span>
              <span class="total">Total Biaya</span><span>:</span><span class="total">${safe(formatRupiah(totalCost))}</span>
            </div>
          </div>
          ${renderListTable()}`
          }

          ${
            pembelianId
              ? ""
              : `<div style="margin-top: 30px; text-align: right;">
            <p class="total">Total Nilai Transaksi: ${safe(formatRupiah(totalCost))}</p>
          </div>`
          }

           <div style="text-align:end; margin-top: 30px; ">(Pasangkayu,...../......./......... )</div>
          <div style="margin-top: 150px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
              <div style="text-align: center; ">
               
                <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                <div style="font-size: 11px; margin-top: 6px;">AM Keuangan</div>
              </div>
              <div style="text-align: center;">
                
                <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                <div style="font-size: 11px; margin-top: 6px;">Pimpinan SEMBAKO 32</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create a base64 SVG for the gradient background
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
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
              <h1 style="font-size: 18px; color: #102853; margin: 0 0 10px 0; font-weight: 700; letter-spacing: 0.5px;">RPK SEMBAKO 32</h1>
              <div style="font-size: 9px; line-height: 1.7; color: #000000; opacity: 0.95;">
                <div><strong style="display: inline-block; width: 45px;">Alamat</strong> : Jl. Soekarno Hatta Pasangkayu</div>
                <div><strong style="display: inline-block; width: 45px;">Kontak</strong> : 0821-9030-9333</div>
                <div><strong style="display: inline-block; width: 45px;">Email</strong> : tigaduaanekapangan@gmail.com</div>
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
        font-family: 'Segoe UI', sans-serif;
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

    console.log("Launching Puppeteer...");

    const getExecutablePath = async () => {
      if (process.env.PUPPETEER_EXEC_PATH)
        return process.env.PUPPETEER_EXEC_PATH;
      try {
        const execPath = await chrome.executablePath;
        if (execPath) return execPath;
      } catch {
        // ignore
      }
      const defaultPaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ];
      for (const p of defaultPaths) {
        try {
          await fs.access(p);
          return p;
        } catch {
          // continue
        }
      }
      return undefined;
    };

    const executablePath = await getExecutablePath();
    console.log("Resolved executable path:", executablePath);

    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium executable not found. Set env PUPPETEER_EXEC_PATH to your Chrome path.",
      );
    }

    console.log("Launching Puppeteer with executable:", executablePath);
    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
      executablePath,
      headless: true,
      timeout: 60000,
    });

    console.log("Creating new page...");
    const page = await browser.newPage();

    // Set longer timeout for page operations
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    console.log("Setting content...");
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for images and styles to load
    await page.waitForTimeout(2000);

    console.log("Generating PDF...");
    let pdfBuffer: Buffer;
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
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate,
        preferCSSPageSize: true,
        timeout: 60000,
      });
      console.log("PDF generated successfully, size:", pdfBuffer.length);
    } catch (pdfError) {
      console.error("PDF generation failed:", pdfError);
      throw pdfError;
    } finally {
      try {
        console.log("Closing browser...");
        await browser.close();
      } catch {
        console.warn("Failed to close browser:");
      }
    }

    const filename = `laporan_pembelian_${new Date().toISOString().split("T")[0]}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", errorMessage);
    if (errorStack) console.error("Error stack:", errorStack);
    return NextResponse.json(
      { error: "Gagal membuat laporan PDF", details: errorMessage },
      { status: 500 },
    );
  }
}
