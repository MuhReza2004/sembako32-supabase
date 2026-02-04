import { supabase } from "@/app/lib/supabase";
import { Penjualan, PenjualanDetail } from "@/app/types/penjualan";

// --- existing createPenjualan function ---
export const createPenjualan = async (data: Penjualan) => {
  // 1. Validate stock for all items
  for (const item of data.items || []) {
    const { data: supplierProduk, error } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", item.supplier_produk_id)
      .single();

    if (error || !supplierProduk) {
      throw new Error(`Produk supplier tidak ditemukan.`);
    }

    const currentStok = supplierProduk.stok;
    if (currentStok < item.qty) {
      throw new Error(`Stok produk tidak mencukupi. Sisa stok: ${currentStok}`);
    }
  }

  // 2. Create the sale record
  const penjualanData = {
    tanggal: data.tanggal,
    pelanggan_id: data.pelanggan_id,
    catatan: data.catatan,
    no_invoice: data.no_invoice,
    no_npb: data.no_npb,
    no_do: data.no_do,
    metode_pengambilan: data.metode_pengambilan,
    total: data.total,
    total_dibayar: data.total_dibayar || 0,
    status: data.status,
    metode_pembayaran: data.metode_pembayaran,
    nomor_rekening: data.nomor_rekening,
    nama_bank: data.nama_bank,
    nama_pemilik_rekening: data.nama_pemilik_rekening,
    tanggal_jatuh_tempo: data.tanggal_jatuh_tempo,
    diskon: data.diskon || 0,
    pajak_enabled: data.pajak_enabled || false,
    pajak: data.pajak || 0,
    total_akhir: data.total_akhir,
  };

  const { data: penjualan, error: penjualanError } = await supabase
    .from("penjualan")
    .insert(penjualanData)
    .select("id")
    .single();

  if (penjualanError) {
    console.error(
      "Error creating penjualan. Data payload:",
      JSON.stringify(penjualanData, null, 2),
    );
    console.error("Supabase Error details:", penjualanError);
    throw penjualanError;
  }

  // 3. Create penjualan_detail records and update stock
  for (const item of data.items || []) {
    // Create detail record
    const { error: detailError } = await supabase
      .from("penjualan_detail")
      .insert({
        penjualan_id: penjualan.id,
        supplier_produk_id: item.supplier_produk_id,
        qty: item.qty,
        harga: item.harga,
        subtotal: item.subtotal,
      });

    if (detailError) {
      console.error("Error creating penjualan detail:", detailError);
      throw detailError;
    }

    // Fetch current stock
    const { data: currentProduct, error: fetchError } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", item.supplier_produk_id)
      .single();

    if (fetchError) {
      console.error("Error fetching stock:", fetchError);
      throw fetchError;
    }

    // Calculate new stock and update
    const newStock = currentProduct.stok - item.qty;
    const { error: stockError } = await supabase
      .from("supplier_produk")
      .update({ stok: newStock })
      .eq("id", item.supplier_produk_id);

    if (stockError) {
      console.error("Error updating stock:", stockError);
      throw stockError;
    }
  }

  return penjualan.id;
};

// --- existing getAllPenjualan function ---
export const getAllPenjualan = async (): Promise<Penjualan[]> => {
  // First fetch penjualan dengan pelanggan
  const { data: penjualanData, error: penjualanError } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (penjualanError) {
    console.error("Error fetching penjualan:", penjualanError);
    throw penjualanError;
  }

  // Then fetch penjualan_detail dengan supplier_produk
  const { data: detailsData, error: detailsError } = await supabase.from(
    "penjualan_detail",
  ).select(`
      *,
      supplier_produk (
        id,
        harga_jual,
        produk (
          id,
          nama,
          satuan
        )
      )
    `);

  if (detailsError) {
    console.error("Error fetching penjualan_detail:", detailsError);
    throw detailsError;
  }

  console.log("Raw penjualan data:", penjualanData);
  console.log("Raw details data:", detailsData);

  // Join penjualan dengan penjualan_detail
  const mappedData = penjualanData.map((item: any) => ({
    id: item.id,
    tanggal: item.tanggal,
    pelanggan_id: item.pelanggan_id,
    catatan: item.catatan,
    no_invoice: item.no_invoice,
    no_npb: item.no_npb,
    no_do: item.no_do,
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
    namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: item.pelanggan?.alamat || "",
    // Get items from detailsData that belong to this penjualan
    items:
      detailsData
        .filter((detail: any) => detail.penjualan_id === item.id)
        .map((detail: any) => ({
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
        })) || [],
  }));

  console.log("Mapped penjualan data:", mappedData);
  return mappedData;
};

// --- NEW getPiutang function ---
export const getPiutang = async (): Promise<Penjualan[]> => {
  const { data, error } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
      )
    `,
    )
    .eq("status", "Belum Lunas")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching piutang:", error);
    throw error;
  }
  return data as Penjualan[];
};

// --- NEW addPiutangPayment function ---
export const addPiutangPayment = async (
  penjualanId: string,
  payment: {
    tanggal: string;
    jumlah: number;
    metode_pembayaran: string;
    atas_nama: string;
  },
): Promise<void> => {
  // First, get current penjualan data
  const { data: penjualanData, error: fetchError } = await supabase
    .from("penjualan")
    .select("*")
    .eq("id", penjualanId)
    .single();

  if (fetchError || !penjualanData) {
    throw new Error("Transaksi penjualan tidak ditemukan.");
  }

  const currentTotalDibayar = penjualanData.total_dibayar || 0;
  const newTotalDibayar = currentTotalDibayar + payment.jumlah;
  const sisaUtang = penjualanData.total_akhir - newTotalDibayar;

  const newStatus = sisaUtang <= 0 ? "Lunas" : "Belum Lunas";

  // Insert payment record
  const { error: paymentError } = await supabase
    .from("riwayat_pembayaran")
    .insert({
      penjualan_id: penjualanId,
      tanggal: payment.tanggal,
      jumlah: payment.jumlah,
      metode_pembayaran: payment.metode_pembayaran,
      atas_nama: payment.atas_nama,
    });

  if (paymentError) {
    console.error("Error adding payment:", paymentError);
    throw paymentError;
  }

  // Update penjualan status and total paid
  const { error: updateError } = await supabase
    .from("penjualan")
    .update({
      total_dibayar: newTotalDibayar,
      status: newStatus,
    })
    .eq("id", penjualanId);

  if (updateError) {
    console.error("Error updating penjualan:", updateError);
    throw updateError;
  }
};

// --- existing updatePenjualanStatus function ---
export const updatePenjualanStatus = async (
  id: string,
  status: "Lunas" | "Belum Lunas" | "Batal",
): Promise<void> => {
  const { error } = await supabase
    .from("penjualan")
    .update({
      status: status,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating penjualan status:", error);
    throw error;
  }
};

// --- existing updatePenjualan function ---
export const updatePenjualan = async (id: string, data: Partial<Penjualan>) => {
  const { data: currentPenjualan, error: fetchError } = await supabase
    .from("penjualan")
    .select("*, penjualan_detail(id, supplier_produk_id, qty)")
    .eq("id", id)
    .single();

  if (fetchError || !currentPenjualan) {
    throw new Error("Transaksi penjualan tidak ditemukan.");
  }

  if (data.items) {
    for (const item of data.items) {
      // Stock validation logic here...
    }

    // Restore old stock
    for (const item of (currentPenjualan as any).penjualan_detail || []) {
      const { data: p, error } = await supabase
        .from("supplier_produk")
        .select("stok")
        .eq("id", item.supplier_produk_id)
        .single();
      if (p) {
        await supabase
          .from("supplier_produk")
          .update({ stok: p.stok + item.qty })
          .eq("id", item.supplier_produk_id);
      }
    }

    // Delete old details
    await supabase.from("penjualan_detail").delete().eq("penjualan_id", id);

    // Create new details and deduct new stock
    for (const item of data.items) {
      await supabase.from("penjualan_detail").insert({
        penjualan_id: id,
        supplier_produk_id: item.supplier_produk_id,
        qty: item.qty,
        harga: item.harga,
        subtotal: item.subtotal,
      });
      const { data: p, error } = await supabase
        .from("supplier_produk")
        .select("stok")
        .eq("id", item.supplier_produk_id)
        .single();
      if (p) {
        await supabase
          .from("supplier_produk")
          .update({ stok: p.stok - item.qty })
          .eq("id", item.supplier_produk_id);
      }
    }
  }

  // Update the main penjualan document
  const { items, ...updateData } = data; // Exclude items from the main update
  const { error: updateError } = await supabase
    .from("penjualan")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error("Error updating penjualan:", updateError);
    throw updateError;
  }
};

// --- existing deletePenjualan function ---
export const deletePenjualan = async (id: string) => {
  const { data: penjualanDetails, error: fetchDetailsError } = await supabase
    .from("penjualan_detail")
    .select("supplier_produk_id, qty")
    .eq("penjualan_id", id);
  if (fetchDetailsError) throw fetchDetailsError;

  for (const item of penjualanDetails || []) {
    const { data: p, error } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", item.supplier_produk_id)
      .single();
    if (p) {
      await supabase
        .from("supplier_produk")
        .update({ stok: p.stok + item.qty })
        .eq("id", item.supplier_produk_id);
    }
  }

  await supabase.from("penjualan_detail").delete().eq("penjualan_id", id);
  await supabase.from("penjualan").delete().eq("id", id);
};

// --- NEW cancelPenjualan function ---
export const cancelPenjualan = async (id: string) => {
  const { data: penjualanDetails, error: fetchDetailsError } = await supabase
    .from("penjualan_detail")
    .select("supplier_produk_id, qty")
    .eq("penjualan_id", id);
  if (fetchDetailsError) throw fetchDetailsError;

  for (const item of penjualanDetails || []) {
    const { data: p, error } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", item.supplier_produk_id)
      .single();
    if (p) {
      await supabase
        .from("supplier_produk")
        .update({ stok: p.stok + item.qty })
        .eq("id", item.supplier_produk_id);
    }
  }

  await supabase.from("penjualan").update({ status: "Batal" }).eq("id", id);
};

// --- existing generateInvoiceNumber function ---
export const generateInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const { count, error } = await supabase
    .from("penjualan")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date(date.setHours(0, 0, 0, 0)).toISOString())
    .lt("created_at", new Date(date.setHours(23, 59, 59, 999)).toISOString());

  if (error) {
    console.error("Error counting invoices:", error);
    return `INV/${year}${month}${day}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `INV/${year}${month}${day}/${String(nextNumber).padStart(4, "0")}`;
};

// --- NEW generateNPBNumber function ---
export const generateNPBNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const { count, error } = await supabase
    .from("penjualan")
    .select("*", { count: "exact", head: true })
    .not("no_npb", "is", null)
    .gte("created_at", new Date(date.setHours(0, 0, 0, 0)).toISOString())
    .lt("created_at", new Date(date.setHours(23, 59, 59, 999)).toISOString());

  if (error) {
    console.error("Error counting NPB:", error);
    return `NPB/${year}${month}${day}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `NPB/${year}${month}${day}/${String(nextNumber).padStart(4, "0")}`;
};

// --- NEW generateDONumber function ---
export const generateDONumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const { count, error } = await supabase
    .from("penjualan")
    .select("*", { count: "exact", head: true })
    .not("no_do", "is", null)
    .gte("created_at", new Date(date.setHours(0, 0, 0, 0)).toISOString())
    .lt("created_at", new Date(date.setHours(23, 59, 59, 999)).toISOString());

  if (error) {
    console.error("Error counting DO:", error);
    return `DO/${year}${month}${day}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `DO/${year}${month}${day}/${String(nextNumber).padStart(4, "0")}`;
};
