import { supabase } from "../lib/supabase";
import { Pembelian, PembelianDetail } from "../types/pembelian";

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
  // Create pembelian record
  const pembelianData = {
    supplier_id: data.supplier_id,
    tanggal: data.tanggal,
    no_do: data.no_do,
    no_npb: data.no_npb,
    invoice: data.invoice,
    total: data.total,
    status: data.status,
  };

  const { data: pembelian, error: pembelianError } = await supabase
    .from("pembelian")
    .insert(pembelianData)
    .select("id")
    .single();

  if (pembelianError) {
    console.error("Error creating pembelian:", pembelianError);
    throw pembelianError;
  }

  // Create pembelian_detail records
  for (const item of data.items) {
    const { error: detailError } = await supabase
      .from("pembelian_detail")
      .insert({
        pembelian_id: pembelian.id,
        supplier_produk_id: item.supplier_produk_id,
        qty: item.qty,
        harga: item.harga,
        subtotal: item.subtotal,
      });

    if (detailError) {
      console.error("Error creating pembelian detail:", detailError);
      throw detailError;
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
        console.error("Error fetching stock:", fetchError);
        throw fetchError;
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
        console.error("Error updating stock:", stockError);
        throw stockError;
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
    console.error("Error fetching pembelian:", error);
    throw error;
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
    console.error("Error updating pembelian:", updateError);
    throw updateError;
  }

  // Then, fetch the purchase details to update stock
  const { data: details, error: detailError } = await supabase
    .from("pembelian_detail")
    .select("supplier_produk_id, qty")
    .eq("pembelian_id", pembelianId);

  if (detailError) {
    console.error("Error fetching pembelian details:", detailError);
    throw detailError;
  }

  for (const detail of details) {
    // 1. Fetch current stock
    const { data: currentProduct, error: fetchError } = await supabase
      .from("supplier_produk")
      .select("stok")
      .eq("id", detail.supplier_produk_id)
      .single();

    if (fetchError) {
      console.error("Error fetching stock for supplier_produk:", fetchError);
      throw fetchError;
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
      console.error("Error updating stock for supplier_produk:", stockError);
      throw stockError;
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
    console.error("Error updating pembelian status:", error);
    throw error;
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
    console.error("Error fetching pembelian details:", error);
    throw error;
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