import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";
import { formatRupiah } from "@/helper/format";
import * as fs from "fs/promises";
import * as path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Penjualan } from "@/app/types/penjualan";

type PenjualanDetailRow = {
  id: string;
  penjualan_id: string;
  supplier_produk_id: string;
  qty: number;
  harga: number;
  subtotal: number;
  created_at: string;
  supplier_produk?: {
    produk?: { nama?: string; satuan?: string };
    harga_jual?: number;
  };
};

type PenjualanRow = Penjualan & {
  pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
  items?: PenjualanDetailRow[];
};

// This function is for server-side use with admin privileges
const getAllPenjualanAdmin = async (): Promise<Penjualan[]> => {
  const { data, error } = await supabaseAdmin
    .from("penjualan")
    .select(
      `
      *,
      pelanggan:pelanggan_id(nama_pelanggan, alamat),
      items:penjualan_detail(
        id, qty, harga,
        supplier_produk:supplier_produk_id(
          id, harga_jual,
          produk:produk_id(nama, satuan)
        )
      )
    `,
    )
    .order("tanggal", { ascending: false });

  if (error) {
    console.error("Error fetching sales data for report:", error);
    throw error;
  }

  // Manually map the data to match the Penjualan type, especially for nested objects
  const penjualanList: Penjualan[] = (data as PenjualanRow[]).map(
    (item: PenjualanRow) => ({
    id: item.id,
    tanggal: item.tanggal,
    pelanggan_id: item.pelanggan_id,
    catatan: item.catatan,
    no_invoice: item.no_invoice,
    no_npb: item.no_npb,
    no_do: item.no_do,
    no_tanda_terima: item.no_tanda_terima,
    metode_pengambilan: item.metode_pengambilan,
    total: item.total,
    total_dibayar: item.total_dibayar,
    status: item.status,
    metode_pembayaran: item.metode_pembayaran,
    nomor_rekening: item.nomor_rekening,
    nama_bank: item.nama_bank,
    nama_pemilik_rekening: item.nama_pemilik_rekening,
    tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
    diskon: item.diskon,
    pajak_enabled: item.pajak_enabled,
    pajak: item.pajak,
    total_akhir: item.total_akhir,
    created_at: item.created_at,
    updated_at: item.updated_at,
    namaPelanggan:
      item.pelanggan?.nama_pelanggan || "Pelanggan Tidak Diketahui",
    alamatPelanggan: item.pelanggan?.alamat || "",
    items: (item.items || []).map((detail: PenjualanDetailRow) => ({
      id: detail.id,
      penjualan_id: detail.penjualan_id,
      supplier_produk_id: detail.supplier_produk_id,
      qty: detail.qty,
      harga: detail.harga,
      subtotal: detail.subtotal,
      created_at: detail.created_at,
      namaProduk:
        detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
      satuan: detail.supplier_produk?.produk?.satuan || "",
      hargaJual: detail.supplier_produk?.harga_jual || detail.harga,
    })),
  }),
  );

  return penjualanList;
};

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json();

    // Read and encode the logo first
    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = logoBuffer.toString("base64");
    const logoSrc = `data:image/svg+xml;base64,${logoBase64}`;

    // Fetch sales data using admin privileges
    const allSales = await getAllPenjualanAdmin();

    // Filter data based on date range
    let filteredSales = allSales;
    if (startDate) {
      filteredSales = filteredSales.filter(
        (sale) => new Date(sale.tanggal) >= new Date(startDate),
      );
    }
    if (endDate) {
      filteredSales = filteredSales.filter(
        (sale) => new Date(sale.tanggal) <= new Date(endDate),
      );
    }

    // Calculate summary
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales
      .filter((sale) => sale.status !== "Batal")
      .reduce((sum, sale) => sum + sale.total, 0);
    const totalPajak = filteredSales.reduce(
      (sum, sale) => sum + (sale.pajak || 0),
      0,
    );
    const penjualanBersih = totalRevenue - totalPajak;
    const paidSales = filteredSales.filter(
      (sale) => sale.status === "Lunas",
    ).length;
    const unpaidSales = filteredSales.filter(
      (sale) => sale.status === "Belum Lunas",
    ).length;

    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Laporan Penjualan</title>
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
          <h2>Laporan Penjualan</h2>
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
    <span>Total Penjualan</span><span>:</span><span>${totalSales}</span>
    <span>Pendapatan Bruto</span><span>:</span><span>${formatRupiah(totalRevenue)}</span>
    <span>Total Pajak</span><span>:</span><span>${formatRupiah(totalPajak)}</span>
    <span style="font-weight: bold;">Pendapatan Netto</span><span>:</span><span style="font-weight: bold;">${formatRupiah(penjualanBersih)}</span>
    <span>Penjualan Lunas</span><span>:</span><span>${paidSales}</span>
    <span>Belum Lunas</span><span>:</span><span>${unpaidSales}</span>
  </div>
</div>


          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>No Dokumen</th>
                <th>Tanggal</th>
                <th>Pelanggan</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales
                .map(
                  (sale, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>
                      <ul>
                        <li>Invoice: ${sale.no_invoice || "-"}</li>
                        <li>DO: ${sale.no_do || "-"}</li>
                        <li>NPB: ${sale.no_npb || "-"}</li>
                      </ul>
                      </td>
                      <td>${new Date(sale.tanggal).toLocaleDateString("id-ID")}</td>
                      <td>${sale.namaPelanggan || "Pelanggan Tidak Diketahui"}</td>
                      <td>${formatRupiah(sale.total)}</td>
                      <td>${sale.status}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: right;">
            <p class="total">Total Nilai Transaksi: ${formatRupiah(totalRevenue)}</p>
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
        width: 100%; /* This is the full margin box width */
        height: 100px;
        -webkit-print-color-adjust: exact;
        color: white;
      ">
        <div style="
          background-image: url('${gradientBg}');
          background-size: cover;
          border-radius: 8px; /* Rounded corners */
          margin: 0 auto; /* Center it */
          width: 85%; /* Adjust width to match container's padding effect, considering PDF margins */
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px; /* Padding for inner content */
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

    // Launch Puppeteer and generate PDF
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

    const page = await browser.newPage();

    // Set longer timeout for page operations
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for images and styles to load
    await page.waitForTimeout(2000);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await page.pdf({
        format: "a4",
        landscape: true,
        printBackground: true,
        margin: {
          top: "140px",
          right: "15px",
          bottom: "80px",
          left: "15px",
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
        await browser.close();
      } catch {
        console.warn("Failed to close browser:");
      }
    }

    // Return PDF as response
    const filename =
      "laporan_penjualan_" + new Date().toISOString().split("T")[0] + ".pdf";
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=" + filename,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", errorMessage);
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      { error: "Gagal membuat laporan PDF", details: errorMessage },
      { status: 500 },
    );
  }
}
