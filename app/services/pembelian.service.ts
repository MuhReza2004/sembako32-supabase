import { supabase } from "../lib/supabase";
import { Pembelian, PembelianDetail } from "../types/pembelian";

const DECIMAL_14_2_MAX = 999999999999.99;

const assertValidMoney = (label: string, value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} tidak valid`);
  }
  if (value > DECIMAL_14_2_MAX) {
    throw new Error(
      `${label} terlalu besar. Maksimal 999.999.999.999,99. Mohon pecah transaksi atau tingkatkan presisi kolom di database.`,
    );
  }
  if (value < 0) {
    throw new Error(`${label} tidak boleh negatif`);
  }
};

export const createPembelian = async (data: {
  supplier_id: string;
  tanggal: string;
  no_do?: string;
  no_npb?: string;
  invoice?: string;
  total: number;
  status: "Pending" | "Completed" | "Decline";
  items: PembelianDetail[];
}) => {
  const totalAmount = Number(data.total);
  assertValidMoney("Total pembelian", totalAmount);

  data.items.forEach((item, index) => {
    assertValidMoney(`Harga item #${index + 1}`, Number(item.harga));
    assertValidMoney(`Subtotal item #${index + 1}`, Number(item.subtotal));
  });

  // Create pembelian record
  const pembelianData = {
    supplier_id: data.supplier_id,
    tanggal: data.tanggal,
    no_do: data.no_do,
    no_npb: data.no_npb,
    invoice: data.invoice,
    total: totalAmount,
    status: data.status,
  };

  const { data: pembelian, error: pembelianError } = await supabase
    .from("pembelian")
    .insert(pembelianData)
    .select("id")
    .single();

  if (pembelianError) {
    const errorMessage = pembelianError?.message || "Gagal membuat pembelian";
    console.error("Error creating pembelian:", errorMessage);
    throw new Error(errorMessage);
  }

  // Create pembelian_detail records
  for (const item of data.items) {
    const { error: detailError } = await supabase
      .from("pembelian_detail")
      .insert({
        pembelian_id: pembelian.id,
        supplier_produk_id: item.supplier_produk_id,
        qty: Number(item.qty),
        harga: Number(item.harga),
        subtotal: Number(item.subtotal),
      });

    if (detailError) {
      const errorMessage = detailError?.message || "Gagal membuat detail pembelian";
      console.error("Error creating pembelian detail:", errorMessage);
      throw new Error(errorMessage);
    }

    // Only update stock if status is not 'Pending'
    if (data.status !== "Pending") {
      // 1. Fetch current stock
      const { data: currentProduct, error: fetchError } = await supabase
        .from("supplier_produk")
        .select("stok")
        .eq("id", item.supplier_produk_id)
        .single();

      if (fetchError) {
        const errorMessage = fetchError?.message || "Gagal mengambil stok supplier produk";
        console.error("Error fetching stock:", errorMessage);
        throw new Error(errorMessage);
      }

      // 2. Calculate new stock
      const newStock = currentProduct.stok + item.qty;

      // 3. Update with new stock value
      const { error: stockError } = await supabase
        .from("supplier_produk")
        .update({
          stok: newStock,
        })
        .eq("id", item.supplier_produk_id);

      if (stockError) {
        const errorMessage = stockError?.message || "Gagal memperbarui stok";
        console.error("Error updating stock:", errorMessage);
        throw new Error(errorMessage);
      }
    }
  }

  return pembelian.id;
};

export const getAllPembelian = async (): Promise<Pembelian[]> => {
  const { data, error } = await supabase
    .from("pembelian")
    .select(
      `
      *,
      suppliers (
        id,
        nama,
        alamat
      ),
      pembelian_detail (
        id,
        pembelian_id,
        supplier_produk_id,
        qty,
        harga,
        subtotal,
        created_at,
        supplier_produk (
          produk (
            nama,
            satuan
          )
        )
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    const errorMessage = error?.message || "Gagal mengambil pembelian";
    console.error("Error fetching pembelian:", errorMessage);
    throw new Error(errorMessage);
  }

  return data.map((item) => ({
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
    namaSupplier: item.suppliers?.nama || "Supplier Tidak Diketahui",
    items:
      item.pembelian_detail?.map((detail: any) => ({
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
      })) || [],
  }));
};

export const updatePembelianAndStock = async (
  pembelianId: string,
  data: {
    no_do?: string;
    no_npb?: string;
    invoice?: string;
  },
) => {
  // First, update the purchase document
  const { error: updateError } = await supabase
    .from("pembelian")
    .update({
      ...data,
      status: "Completed",
    })
    .eq("id", pembelianId);

  if (updateError) {
    const errorMessage = updateError?.message || "Gagal memperbarui pembelian";
    console.error("Error updating pembelian:", errorMessage);
    throw new Error(errorMessage);
  }

  // Then, fetch the purchase details to update stock
  const { data: details, error: detailError } = await supabase
    .from("pembelian_detail")
    .select("supplier_produk_id, qty")
    .eq("pembelian_id", pembelianId);

  if (detailError) {
    const errorMessage = detailError?.message || "Gagal mengambil detail pembelian untuk update stok";
    console.error("Error fetching pembelian details:", errorMessage);
    throw new Error(errorMessage);
  }

  for (const detail of details) {
    // 1. Fetch current stock
    const { data: currentProduct, error: fetchError } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", detail.supplier_produk_id)
      .single();

    if (fetchError) {
      const errorMessage = fetchError?.message || "Gagal mengambil stok supplier produk untuk update";
      console.error("Error fetching stock for supplier_produk:", errorMessage);
      throw new Error(errorMessage);
    }
    
    // 2. Calculate new stock
    const newStock = currentProduct.stok + detail.qty;

    // 3. Update with new stock value
    const { error: stockError } = await supabase
      .from("supplier_produk")
      .update({
        stok: newStock,
      })
      .eq("id", detail.supplier_produk_id);

    if (stockError) {
      const errorMessage = stockError?.message || "Gagal memperbarui stok supplier produk";
      console.error("Error updating stock for supplier_produk:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};

export const updatePembelianStatus = async (
  pembelianId: string,
  status: "Pending" | "Completed" | "Decline",
) => {
  const { error } = await supabase
    .from("pembelian")
    .update({
      status: status,
    })
    .eq("id", pembelianId);

  if (error) {
    const errorMessage = error?.message || "Gagal memperbarui status pembelian";
    console.error("Error updating pembelian status:", errorMessage);
    throw new Error(errorMessage);
  }
};

export const getPembelianDetails = async (
  pembelianId: string,
): Promise<PembelianDetail[]> => {
  const { data, error } = await supabase
    .from("pembelian_detail")
    .select(
      `
      *,
      supplier_produk (
        produk (
          nama,
          satuan
        )
      )
    `,
    )
    .eq("pembelian_id", pembelianId);

  if (error) {
    const errorMessage = error?.message || "Gagal mengambil detail pembelian";
    console.error("Error fetching pembelian details:", errorMessage);
    throw new Error(errorMessage);
  }

  return data.map((detail) => ({
    id: detail.id,
    pembelian_id: detail.pembelian_id,
    supplier_produk_id: detail.supplier_produk_id,
    qty: detail.qty,
    harga: detail.harga,
    subtotal: detail.subtotal,
    created_at: detail.created_at, // Ensure created_at is mapped
    namaProduk:
      detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
    satuan: detail.supplier_produk?.produk?.satuan || "",
  }));
};
