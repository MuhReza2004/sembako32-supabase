import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";
import * as fs from "fs/promises";
import * as path from "path";
import { formatRupiah } from "@/helper/format";

export async function POST(request: NextRequest) {
  try {
    const { deliveryOrder } = await request.json();
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

    const items = deliveryOrder.penjualan.items || [];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Tanda Terima</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            h2 { color: #111827; text-align: center; margin: 0; }
            .meta { margin-top: 30px; display: grid; grid-template-columns: 180px 10px auto; row-gap: 6px; }
            .box { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; margin-top: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background-color: #f9fafb; }
            .signature { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .line { border-top: 1px solid #333; width: 180px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <h2 style="text-decoration: underline;">TANDA TERIMA BARANG</h2>
          <h4 style="text-align: center;">NO: ${deliveryOrder.no_tanda_terima}</h4>
          <div class="meta">
            <span>Referensi No. DO</span><span>:</span><span>${deliveryOrder.no_do}</span>
            <span>Tanggal</span><span>:</span><span>${new Date(deliveryOrder.penjualan.tanggal).toLocaleDateString("id-ID")}</span>
            <span>Penerima</span><span>:</span><span>${deliveryOrder.penjualan.pelanggan?.nama_pelanggan || "-"}</span>
            <span>Alamat</span><span>:</span><span>${deliveryOrder.penjualan.pelanggan?.alamat || "-"}</span>
          </div>

          <div class="box">
            Dengan ini menyatakan bahwa barang telah diterima dengan baik dan sesuai.
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
                    (item: any, index: number) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${item.supplier_produk?.produk?.nama || "Produk"}</td>
                        <td>${item.qty}</td>
                        <td>${formatRupiah(item.harga || 0)}</td>
                        <td>${formatRupiah(item.subtotal || 0)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <div class="signature">
            <div style="text-align: center;">
              <div style="margin-bottom: 60px;">Diterima Oleh</div>
              <div class="line"></div>
            </div>
            <div style="text-align: center;">
              <div style="margin-bottom: 60px;">Diserahkan Oleh</div>
              <div class="line"></div>
            </div>
          </div>
        </body>
      </html>
    `;

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
    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium executable not found. Set env PUPPETEER_EXEC_PATH to your Chrome path.",
      );
    }

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
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

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

    const filename = `bast_${deliveryOrder.no_do}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating BAST PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Gagal membuat PDF Berita Acara", details: errorMessage },
      { status: 500 },
    );
  }
}
