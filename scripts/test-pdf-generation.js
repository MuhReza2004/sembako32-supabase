#!/usr/bin/env node

/**
 * PDF Generation Diagnostic Tool
 * Run: node scripts/test-pdf-generation.js
 * 
 * This script tests the PDF generation endpoint with sample data
 * and reports detailed diagnostic information
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const API_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const INVOICE_API = `${API_URL}/api/generate-invoice`;

// Sample test data matching your schema
const sampleInvoice = {
  id: "diagnostic-test-id",
  tanggal: new Date().toISOString().split("T")[0],
  pelanggan_id: "test-pelanggan",
  catatan: null,
  no_invoice: `INV/DIAG/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(Date.now() % 10000).padStart(4, "0")}`,
  no_npb: "NPB/DIAG/2026/02/05/0001",
  no_do: null,
  no_tanda_terima: null,
  metode_pengambilan: "Ambil Langsung",
  total: 1730000,
  total_dibayar: 0,
  status: "Lunas",
  metode_pembayaran: "Tunai",
  nomor_rekening: "",
  nama_bank: "",
  nama_pemilik_rekening: "",
  tanggal_jatuh_tempo: null,
  diskon: 0,
  pajak_enabled: false,
  pajak: 0,
  total_akhir: 1730000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: "test-user",
  createdByEmail: "test@example.com",
  createdByRole: "admin",
  namaPelanggan: "Diagnostic Test Customer",
  alamatPelanggan: "Jl. Test No. 123",
  nama_toko: "Test Store",
  items: [
    {
      id: "diag-item-1",
      penjualan_id: "diagnostic-test-id",
      supplier_produk_id: "test-produk-1",
      qty: 2,
      harga: 865000,
      subtotal: 1730000,
      created_at: new Date().toISOString(),
      namaProduk: "Test Product 1 - Diagnostic",
      satuan: "Sak",
      hargaJual: 865000,
    },
  ],
};

async function runDiagnostics() {
  console.log("\n🔍 PDF Generation Diagnostic Tool\n");
  console.log("=" .repeat(60));

  // Test 1: Check API availability
  console.log("\n📡 Test 1: Checking API availability...");
  try {
    const response = await fetch(INVOICE_API, {
      method: "OPTIONS",
      timeout: 5000,
    });
    console.log(`✅ API endpoint is reachable (status: ${response.status})`);
  } catch (error) {
    console.log(`❌ API endpoint not reachable: ${error.message}`);
    console.log(`   Make sure server is running at: ${API_URL}`);
    return;
  }

  // Test 2: Send PDF generation request
  console.log("\n📄 Test 2: Requesting PDF generation...");
  console.log(`   Invoice #: ${sampleInvoice.no_invoice}`);
  console.log(`   Customer: ${sampleInvoice.namaPelanggan}`);
  console.log(`   Items: ${sampleInvoice.items.length}`);
  console.log(`   Total: Rp ${sampleInvoice.total_akhir.toLocaleString("id-ID")}`);

  try {
    const response = await fetch(INVOICE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sampleInvoice),
      timeout: 120000, // 2 minutes
    });

    console.log(`\n📊 Response Status: ${response.status}`);
    console.log(
      `   Content-Type: ${response.headers.get("content-type")}`
    );
    console.log(
      `   Content-Length: ${response.headers.get("content-length")} bytes`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ Error Response:`);
      console.log(errorText);
      return;
    }

    // Test 3: Validate PDF content
    console.log("\n🧪 Test 3: Validating PDF...");
    const buffer = await response.buffer();
    console.log(`   PDF Size: ${buffer.length} bytes`);

    if (buffer.length < 1000) {
      console.log(`   ⚠️  WARNING: PDF suspiciously small!`);
    } else if (buffer.length > 50000000) {
      console.log(`   ⚠️  WARNING: PDF suspiciously large!`);
    } else {
      console.log(`   ✅ PDF size reasonable`);
    }

    // Check PDF magic bytes
    const pdfMagic = buffer.toString("utf8", 0, 4);
    if (pdfMagic.startsWith("%PDF")) {
      console.log(`   ✅ Valid PDF format detected`);
    } else {
      console.log(`   ❌ Invalid PDF format! Magic bytes: ${pdfMagic}`);
    }

    // Test 4: Save PDF for manual inspection
    console.log("\n💾 Test 4: Saving PDF for inspection...");
    const outputPath = path.join(
      process.cwd(),
      `test-invoice-${Date.now()}.pdf`
    );
    fs.writeFileSync(outputPath, buffer);
    console.log(`   ✅ Saved to: ${outputPath}`);
    console.log(`   📖 Open this file to verify content appears correctly`);

    // Test 5: Summary
    console.log("\n" + "=" .repeat(60));
    console.log("✅ All tests completed!");
    console.log("\nNext steps:");
    console.log("1. Open the generated PDF file and verify content");
    console.log("2. Check Vercel Function logs for detailed output");
    console.log("3. Look for [INVOICE] prefixed log messages");
    console.log("4. If content is missing, check [PDF DEBUG] output");
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    if (error.code === "ECONNREFUSED") {
      console.log(
        "   Server is not running. Start it with: npm run dev"
      );
    }
  }

  console.log("\n" + "=" .repeat(60) + "\n");
}

// Run diagnostics
runDiagnostics().catch(console.error);
