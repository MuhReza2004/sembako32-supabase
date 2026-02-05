/**
 * Quick HTML test to verify PDF generation is working
 * Run this in browser console or via test endpoint
 */

export async function testPdfGeneration() {
  // Sample invoice data - same structure as your real data
  const testData = {
    id: "test-id",
    tanggal: "2026-02-05",
    no_invoice: "INV/TEST/2026/02/9999",
    no_npb: "NPB/TEST/2026/02/05/9999",
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
    namaPelanggan: "Test Customer",
    alamatPelanggan: "Test Address",
    nama_toko: "Test Store",
    items: [
      {
        id: "item-1",
        penjualan_id: "test-id",
        supplier_produk_id: "test-produk",
        qty: 1,
        harga: 870000,
        subtotal: 870000,
        created_at: new Date().toISOString(),
        namaProduk: "Test Product 1",
        satuan: "Sak",
        hargaJual: 870000,
      },
      {
        id: "item-2",
        penjualan_id: "test-id",
        supplier_produk_id: "test-produk",
        qty: 1,
        harga: 860000,
        subtotal: 860000,
        created_at: new Date().toISOString(),
        namaProduk: "Test Product 2",
        satuan: "Sak",
        hargaJual: 860000,
      },
    ],
  };

  try {
    console.log("[TEST] Sending PDF generation request...");
    const response = await fetch("/api/generate-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    console.log("[TEST] Response status:", response.status);
    console.log("[TEST] Response headers:", {
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[TEST] Error response:", error);
      return;
    }

    const blob = await response.blob();
    console.log("[TEST] PDF blob size:", blob.size, "bytes");

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test-invoice.pdf";
    a.click();
    console.log("[TEST] PDF downloaded");
  } catch (error) {
    console.error("[TEST] Error:", error);
  }
}

// Usage: 
// Open browser console on the app
// Run: testPdfGeneration()
