import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";
import { formatRupiah } from "@/helper/format";
import * as fs from "fs/promises";
import * as path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Pembelian } from "@/app/types/pembelian";

// This function is for server-side use with admin privileges
const getAllPembelianAdmin = async (): Promise<Pembelian[]> => {
  const { data, error } = await supabaseAdmin
    .from("pembelian")
    .select(
      `
      *,
      supplier:supplier_id(nama),
      items:pembelian_detail(
        id, qty, harga,
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

  const pembelianList: Pembelian[] = data.map((item: Pembelian) => ({
    id: item.id,
    supplier_id: item.supplier_id,
    tanggal: item.tanggal,
    no_do: item.no_do,
    no_npb: item.no_npb,
    invoice: item.invoice,
    total: item.total,
    status: item.status,
    created_at: item.created_at,
    updated_at: item.updated_at,
    nama_supplier: item.supplier?.nama || "Supplier Tidak Diketahui",
    items: item.items.map((detail: any) => ({
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
  }));

  return pembelianList;
};

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json();

    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = logoBuffer.toString("base64");
    const logoSrc = `data:image/svg+xml;base64,${logoBase64}`;

    const allPurchases = await getAllPembelianAdmin();

    let filteredPurchases = allPurchases;
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Laporan Pembelian</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Laporan Pembelian</h2>
          <p>Periode: ${
            startDate && endDate
              ? new Date(startDate).toLocaleDateString("id-ID") +
                " - " +
                new Date(endDate).toLocaleDateString("id-ID")
              : startDate
                ? "Dari: " + new Date(startDate).toLocaleDateString("id-ID")
                : endDate
                  ? "Sampai: " + new Date(endDate).toLocaleDateString("id-ID")
                  : "Semua Periode"
          }</p>
<div style="margin-bottom: 20px;">
  <div style="display: grid; grid-template-columns: 180px 10px auto;">
    <span>Total Pembelian</span><span>:</span><span>${totalPurchases}</span>
    <span>Total Dibayar</span><span>:</span><span>${paidPurchases}</span>
    <span>Total Belum Dibayar</span><span>:</span><span>${unpaidPurchases}</span>
    <span style="font-weight: bold;">Total Biaya</span><span>:</span><span style="font-weight: bold;">${formatRupiah(totalCost)}</span>
  </div>
</div>


          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>No Dokumen</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPurchases
                .map(
                  (p, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${new Date(p.tanggal).toLocaleDateString("id-ID")}</td>
                      <td>
                      <ul>
                        <li>No NPB: ${p.no_npb || "-"}</li>
                        <li>No DO: ${p.no_do || "-"}</li>
                        <li>Invoice: ${p.invoice || "-"}</li>
                      </ul>
                      </td>
                      <td>${p.nama_supplier}</td>
                      <td>${formatRupiah(p.total)}</td>
                      <td>${p.status === "Completed" ? "Lunas" : p.status === "Pending" ? "Pending" : "Decline"}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: right;">
            <p class="total">Total Nilai Transaksi: ${formatRupiah(totalCost)}</p>
          </div>

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
