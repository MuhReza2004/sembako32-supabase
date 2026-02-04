import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";
import { formatRupiah } from "@/helper/format";
import * as fs from "fs/promises";
import * as path from "path";

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
    const total = items.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Delivery Order ${deliveryOrder.no_do}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            h2 { color: #111827; text-align: center; margin: 0; }
            .meta { margin-top: 10px; display: grid; grid-template-columns: 160px 10px auto; row-gap: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background-color: #f9fafb; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>DELIVERY ORDER</h2>
          <div class="meta">
            <span>No. DO</span><span>:</span><span>${deliveryOrder.no_do}</span>
            <span>No. Tanda Terima</span><span>:</span><span>${deliveryOrder.no_tanda_terima || "-"}</span>
            <span>No. Invoice</span><span>:</span><span>${deliveryOrder.penjualan.no_invoice || "-"}</span>
            <span>No. NPB</span><span>:</span><span>${deliveryOrder.penjualan.no_npb || "-"}</span>
            <span>Tanggal</span><span>:</span><span>${new Date(deliveryOrder.penjualan.tanggal).toLocaleDateString("id-ID")}</span>
            <span>Pelanggan</span><span>:</span><span>${deliveryOrder.penjualan.pelanggan?.nama_pelanggan || "-"}</span>
            <span>Alamat</span><span>:</span><span>${deliveryOrder.penjualan.pelanggan?.alamat || "-"}</span>
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

          <div style="margin-top: 16px; text-align: right;">
            <p class="total">Total: ${formatRupiah(total)}</p>
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
