import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { Penjualan } from "@/app/types/penjualan";
import { requireAuth } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import { escapeHtml } from "@/helper/escapeHtml";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPuppeteerLaunchOptions } from "@/lib/puppeteer";
import { getPdfFontCss, waitForPdfFonts } from "@/lib/pdf-fonts";
import { debugPdfContent } from "@/lib/pdf-debug";

export const runtime = "nodejs";
export const maxDuration = 60;

function numberToWords(num: number): string {
  const units = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
  ];
  const teens = [
    "sepuluh",
    "sebelas",
    "dua belas",
    "tiga belas",
    "empat belas",
    "lima belas",
    "enam belas",
    "tujuh belas",
    "delapan belas",
    "sembilan belas",
  ];
  const tens = [
    "",
    "",
    "dua puluh",
    "tiga puluh",
    "empat puluh",
    "lima puluh",
    "enam puluh",
    "tujuh puluh",
    "delapan puluh",
    "sembilan puluh",
  ];
  const thousands = ["", "ribu", "juta", "miliar", "triliun"];

  if (num === 0) return "nol";

  function convertHundreds(n: number): string {
    let str = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) {
      if (h === 1) str += "seratus ";
      else str += units[h] + " ratus ";
    }

    if (t > 0) {
      if (t === 1) {
        str += teens[u] + " ";
        return str.trim();
      } else {
        str += tens[t] + " ";
      }
    }

    if (u > 0) {
      str += units[u] + " ";
    }

    return str.trim();
  }

  let result = "";
  let tempNum = num;
  let thousandIndex = 0;

  while (tempNum > 0) {
    const chunk = tempNum % 1000;
    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk);
      if (thousandIndex === 1 && chunk === 1) {
        result = "seribu " + result;
      } else if (chunkWords) {
        result = chunkWords + " " + thousands[thousandIndex] + " " + result;
      }
    }
    tempNum = Math.floor(tempNum / 1000);
    thousandIndex++;
  }

  return result.trim() + " rupiah";
}

async function generatePdf(
  penjualan: Penjualan & { nama_toko?: string },
): Promise<Buffer> {
  const safe = (value: string | number | null | undefined) =>
    escapeHtml(String(value ?? ""));
  // The customer store name ('nama_toko') is now passed directly in the 'penjualan' object.

  // Calculate total amount for terbilang
  const subTotal = (penjualan.items || []).reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const diskonAmount = penjualan.diskon
    ? (subTotal * penjualan.diskon) / 100
    : 0;
  const totalSetelahDiskon = subTotal - diskonAmount;
  const pajakAmount = penjualan.pajak_enabled ? totalSetelahDiskon * 0.11 : 0;
  const totalAkhir = penjualan.total_akhir ?? totalSetelahDiskon + pajakAmount;

  const launchOptions = await getPuppeteerLaunchOptions();
  const browser = await puppeteer.launch({
    ...launchOptions,
    timeout: 60000,
  });

  const page = await browser.newPage();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });

  let paymentDetailsHtml = `
    <div class="invoice-item">
      <span class="label">Pembayaran</span>
      <span class="value">${safe(penjualan.metode_pembayaran || "N/A")}</span>
    </div>
  `;
  if (penjualan.metode_pembayaran === "Transfer") {
    paymentDetailsHtml += `
      <div class="invoice-item">
        <span class="label">Bank</span>
        <span class="value">${safe(penjualan.nama_bank || "")}</span>
      </div>
      <div class="invoice-item">
        <span class="label">A/n</span>
        <span class="value">${safe(penjualan.nama_pemilik_rekening || "")}</span>
      </div>
      <div class="invoice-item">
        <span class="label">No Rek</span>
        <span class="value">${safe(penjualan.nomor_rekening || "")}</span>
      </div>
    `;
  }

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Invoice ${safe(penjualan.no_invoice)}</title>
    <style>
      ${await getPdfFontCss()}
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'PdfFont', Arial, sans-serif;
        padding: 30px 40px;
        color: #333;
        font-size: 11px;
        line-height: 1.5;
      }

      .container {
        max-width: 100%;
      }

      /* Header Section */
      .header {
        display: flex;
        
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 25px;
        padding-bottom: 20px;
        border-bottom: 3px solid #102853;
      }

      .company-section {
        flex: 1;
      }
      .company-item {
      display: flex;
      font-size:12px;
      color: #555;
      margin: 2px 0;
      }
      
      .company-item .label {
      width: 70px;
      position: relative;
      font-weight: 600;
      }

      .company-item .label::after{
      content: ":";
      position: absolute;
      right: 0;
      }

      .company-item .value {
      margin-left: 5px;
      }

      .company-header {
        display: flex;
        align-items: center;
        margin-top: 8px;
        gap: 15px;
        margin-bottom: 8px;
      }

      .logo-container {
        width: 70px;
        height: 70px;
        flex-shrink: 0;
      }

      .logo-container img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .company-header h2 {
        font-size: 15px;
        font-weight: bold;
        color: #102853;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .company-details {
        margin-top: 20px;
        
      }

      .company-details p {
        position: relative;
        font-size: 12px;
        color: #555;
        margin: 2px 0;
        line-height: 1.4;
      }

.invoice-item {
  display: flex;
  font-size:12px;
  color: #555;
  margin: 2px 0;
}
      
.invoice-item .label {
  width: 100px;
  position: relative;
  font-weight: 600;
}
.invoice-item .label::after {
  content: ": ";
  position: absolute;
  right: 0;
}

.invoice-item .value {
  margin-left: 5px;
}
      


      .invoice-section {
        text-align: left;
        min-width: 280px;
      }

      .invoice-section h1 {
        font-size: 32px;
        font-weight: bold;
        text-align: right;
        color: #102853;
        margin-bottom: 12px;
        letter-spacing: 3px;
      }

      .invoice-meta {
        background: #fff9e6;
        padding: 12px;
        border-radius: 5px;
        border-left: 4px solid #102853;
      }

      .invoice-meta p {
        font-size: 11px;
        margin: 4px 0;
        color: #333;
      }

      .invoice-meta strong {
        color: #102853;
        font-weight: 600;
      }

      /* Customer & Amount Section */
      .customer-amount-section {
        display: flex;
        justify-content: space-between;
        gap: 30px;
        margin-bottom: 25px;
      }

      .customer-section {
        flex: 1;
        background: #fff9e6;
        padding: 15px;
        border-radius: 5px;
      }

      .customer-section p {
        font-size: 11px;
        margin: 5px 0;
        color: #333;
      }

      .customer-section p:first-child {
        font-weight: bold;
        color: #102853;
        margin-bottom: 8px;
        font-size: 11px;
      }

      .customer-item {
        display: flex;
        margin: 5px 0;
        font-size: 11px;
        color: #333;
      }

      .label {
        width: 70px;
        position: relative;
        text-align: left;
        font-weight: 600;
        color: #555;
      }
      
      .label::after {
        content: ":";
        position: absolute;
        right: 0;
      }

      .value {
        flex: 1;
        margin-left:5px 
      }

      .amount-highlight {
        min-width: 280px;
        background:  #fff9e6;
        padding: 20px;
        
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }

      .amount-highlight p:first-child {
        font-size: 11px;
        color: #000000;
        margin-bottom: 8px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .amount-highlight .amount {
        font-size: 28px;
        font-weight: bold;
        color: #000000;
        letter-spacing: 1px;
      }

      /* Table Section */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }

      thead {
        background: #102853;
        color: white;
      }

      th {
        padding: 12px 10px;
        text-align: left;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      td {
        padding: 10px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 11px;
      }

      tbody tr:hover {
        background-color: #fff9e6;
      }

      tbody tr:last-child td {
        border-bottom: 2px solid #102853;
      }

      .text-center {
        text-align: center;
      }

      .text-right {
        text-align: right;
      }

      /* Terbilang Section */
      .terbilang-section {
        background: #fff9e6;
        padding: 12px 15px;
        margin: 20px 0;
        border-radius: 5px;
        border-left: 4px solid #fec335;
      }

      .terbilang-section p {
        font-size: 11px;
        color: #333;
        font-style: italic;
      }

      .terbilang-section strong {
        color: #fec335;
        font-weight: 600;
      }

      /* Summary and Footer Section */
      .summary-footer-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 20px;
        gap: 30px;
      }

      .summary-container {
        display: flex;
        justify-content: flex-end;
        flex: 1;
      }

      .summary-table {
        width: 200px;
      }

      .summary-table table {
        width: 100%;
        margin: 0;
      }

      .summary-table td {
        padding: 8px 12px;
        border: none;
        font-size: 11px;
      }

      .summary-table tr {
        background: #fff9e6;
      }

      .summary-table tr:last-child {
        background: #102853;
        color: white;
        font-weight: bold;
        font-size: 13px;
      }

      .summary-table tr:last-child td {
        padding: 12px;
        border-top: 2px solid #102853;
      }

      /* Footer Section */
      .footer-notes {
        padding: 15px;
        background: #fff9e6;
        border-radius: 5px;
        width: 300px;
        flex-shrink: 0;
      }

      .footer-notes p {
        font-size: 10px;
        color: #555;
        margin: 3px 0;
        line-height: 1.6;
      }

      .footer-notes strong {
        color: #102853;
      }

      /* Signature Section */
      .signature-section {
        display: flex;
        justify-content: space-between;
        padding-top: 20px;
      }

      .signature-box {
        text-align: center;
        width: 220px;
      }

      .signature-box p {
        font-size: 11px;
        margin-bottom: 50px;
        font-weight: 600;
        color: #333;
      }

      .signature-line {
        border-top: 1px solid #333;
        padding-top: 8px;
        font-size: 10px;
        color: #555;
      }

      /* Utility Classes */
      .bold {
        font-weight: 600;
      }

      .mb-10 {
        margin-bottom: 10px;
      }

      .mb-20 {
        margin-bottom: 20px;
      }
    </style>
  </head>

  <body>
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <div class="company-section">
          <div class="company-header">
            <div class="logo-container">
              <img src="${baseUrl}/logo.svg" alt="Logo" onerror="this.style.display='none'" />
            </div>
            <h2>RPK SEMBAKO 32</h2>
          </div>
          <div class="company-details">
            <div class="company-item">
            <span class="label">Alamat</span>
            <span class="value">Jl. Soekarno Hatta Pasangkayu</span>
          </div>
            <div class="company-item">
            <span class="label">Kontak</span>
            <span class="value">0821-9927-7377</span>
          </div>
            <div class="company-item">
            <span class="label">Email</span>
            <span class="value">tigaduaanekapangan@gmail.com</span>
          </div>
            </div>
        </div>

        <div class="invoice-section">
          <h1>INVOICE</h1>
          <div class="invoice-meta">
        <div class="invoice-item">
          <span class="label">No Invoice</span>
          <span class="value">${safe(penjualan.no_invoice)}</span>
        </div>
        <div class="invoice-item">
          <span class="label">No. NPB</span>
          <span class="value">${safe(penjualan.no_npb)}</span>
        </div>
        ${
          penjualan.metode_pengambilan === "Diantar" && penjualan.no_do
            ? `
        <div class="invoice-item">
          <span class="label">No. DO</span>
          <span class="value">${safe(penjualan.no_do)}</span>
        </div>
        `
            : ""
        }
        <div class="invoice-item">
          <span class="label">Tanggal</span>
          <span class="value">${safe(new Date(penjualan.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }))}</span>
        </div>
        ${paymentDetailsHtml}
        ${
          penjualan.status === "Belum Lunas" && penjualan.tanggal_jatuh_tempo
            ? `
        <div class="invoice-item">
          <span class="label">Jatuh Tempo</span>
          <span class="value">${safe(new Date(penjualan.tanggal_jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }))}</span>
        </div>
        `
            : ""
        }
          </div>
        </div>
      </div>

      <!-- CUSTOMER & AMOUNT -->
      <div class="customer-amount-section">
        <div class="customer-section">
          <p>Kepada Yth.</p>
          <div class="customer-item">
            <span class="label">Nama</span>
            <span class="value">${safe(penjualan.namaPelanggan)}</span>
          </div>
          <div class="customer-item">
            <span class="label">Toko</span>
            <span class="value">${safe(penjualan.nama_toko || "-")}</span>
          </div>
          <div class="customer-item">
            <span class="label">Status</span>
            <span class="value">${safe(penjualan.status)}</span>
          </div>
          <div class="customer-item">
            <span class="label">Pengiriman</span>
            <span class="value">${safe(penjualan.metode_pengambilan)}</span>
          </div>
        </div>

        <div class="amount-highlight">
          <p>Total Yang Harus Dibayar</p>
          <div class="amount">Rp ${safe(totalAkhir.toLocaleString("id-ID"))}</div>
        </div>
      </div>

      <!-- TABLE -->
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 40px;">No</th>
            <th>Nama Produk</th>
            <th class="text-center" style="width: 60px;">Qty</th>
            <th class="text-center" style="width: 70px;">Satuan</th>
            <th class="text-right" style="width: 120px;">Harga</th>
            <th class="text-right" style="width: 120px;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${(penjualan.items || [])
            .map(
              (item, i) => `
            <tr>
              <td class="text-center">${i + 1}</td>
              <td><strong>${safe(item.namaProduk)}</strong></td>
              <td class="text-center">${safe(item.qty)}</td>
              <td class="text-center">${safe(item.satuan || "")}</td>
              <td class="text-right">Rp ${safe(((item.hargaJual ?? item.harga) || 0).toLocaleString("id-ID"))}</td>
              <td class="text-right"><strong>Rp ${safe(item.subtotal.toLocaleString("id-ID"))}</strong></td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <!-- TERBILANG -->
      <div class="terbilang-section">
        <p><strong>Terbilang:</strong> <em>${safe(numberToWords(Math.floor(totalAkhir)))}</em></p>
      </div>

      <!-- SUMMARY AND FOOTER -->
      <div class="summary-footer-container">
        <div class="footer-notes">
          <p><strong>Terima kasih atas kepercayaan Anda.</strong></p>
          <p>Mohon simpan dokumen ini sebagai bukti transaksi yang sah.</p>
          <p style="font-style: italic; margin-top: 8px;">Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan basah.</p>
        </div>

        <div class="summary-container">
          <div class="summary-table">
            <table>
              <tr>
                <td>Subtotal</td>
                <td class="text-right">Rp ${safe(subTotal.toLocaleString("id-ID"))}</td>
              </tr>
              ${
                penjualan.diskon && penjualan.diskon > 0
                  ? `
                <tr>
                  <td>Diskon (${penjualan.diskon}%)</td>
                  <td class="text-right">- Rp ${safe(diskonAmount.toLocaleString("id-ID"))}</td>
                </tr>
                `
                  : ""
              }
              ${
                penjualan.pajak_enabled && pajakAmount > 0
                  ? `
                <tr>
                  <td>PPN 11%</td>
                  <td class="text-right">Rp ${safe(pajakAmount.toLocaleString("id-ID"))}</td>
                </tr>
              `
                  : ""
              }
              <tr>
                <td><strong>TOTAL</strong></td>
                <td class="text-right"><strong>Rp ${safe(totalAkhir.toLocaleString("id-ID"))}</strong></td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <!-- SIGNATURE -->
      <div class="signature-section">
        <div class="signature-box">
          <p>Hormat Kami,</p>
          <div class="signature-line">RPK Sembako 32</div>
        </div>
        <div class="signature-box">
          <p>Diterima Oleh,</p>
          <div class="signature-line">( ${safe(penjualan.namaPelanggan)} )</div>
        </div>
      </div>

    </div>
  </body>
  </html>
  `;

  // Set content with multiple wait conditions
  console.log("Setting page content for invoice:", penjualan.no_invoice);
  await page.setContent(htmlContent, { 
    waitUntil: ["load", "networkidle0", "domcontentloaded"],
    timeout: 30000 
  });
  console.log("Page content set, starting font wait...");

  // Wait for fonts and content to be fully rendered
  await waitForPdfFonts(page);
  console.log("Font wait completed");

  // Debug: Check if content is actually rendered
  await debugPdfContent(page, penjualan.no_invoice);

  // Additional stability check - ensure all elements are visible
  await page.evaluate(() => {
    return new Promise((resolve) => {
      // Force a reflow to ensure all styles are applied
      document.body.offsetHeight;
      // Wait a bit more for any async rendering
      setTimeout(resolve, 500);
    });
  });

  console.log("Starting PDF generation...");
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      right: "30px",
      bottom: "20px",
      left: "30px",
    },
  });
  console.log("PDF generated, size:", pdfBuffer.length, "bytes");

  await browser.close();

  return Buffer.from(pdfBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;
    const { role, userId } = guard;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`pdf:invoice:${ip}`, 10, 60_000);
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

    const penjualan: Penjualan = await request.json();
    console.log("Received penjualan data:", JSON.stringify(penjualan, null, 2));

    // Validate required fields
    if (
      !penjualan.no_invoice ||
      !penjualan.namaPelanggan ||
      !penjualan.items ||
      penjualan.items.length === 0
    ) {
      throw new Error(
        "Missing required fields: no_invoice, namaPelanggan, or items",
      );
    }

    // Validate items
    for (const item of penjualan.items) {
      // Accept both hargaJual and harga field names
      const priceValue = item.hargaJual ?? item.harga;
      if (
        !item.namaProduk ||
        typeof item.qty !== "number" ||
        typeof priceValue !== "number"
      ) {
        throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
      }
    }

    if (role !== "admin") {
      const { data: owned } = await supabaseAdmin
        .from("penjualan")
        .select("id, created_by")
        .eq("no_invoice", penjualan.no_invoice)
        .single();
      if (!owned || owned.created_by !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const pdfData = await generatePdf(penjualan);

    return new NextResponse(new Uint8Array(pdfData), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice_${penjualan.no_invoice}.pdf"`,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: errorMessage,
        stack: errorStack,
      },
      { status: 500 },
    );
  }
}

