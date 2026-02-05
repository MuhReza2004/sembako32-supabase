import { supabase } from "../lib/supabase";
import { Pembelian, PembelianDetail } from "../types/pembelian";

type PembelianDetailRow = PembelianDetail & {
  supplier_produk?: {
    produk?: { nama?: string; satuan?: string };
  };
};

type PembelianDetailInput = Pick<
  PembelianDetail,
  "supplier_produk_id" | "qty" | "harga" | "subtotal"
>;

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

const increaseStock = async (supplierProdukId: string, qty: number) => {
  const { data, error } = await supabase.rpc("increase_stock", {
    p_supplier_produk_id: supplierProdukId,
    p_qty: qty,
  });
  if (error) {
    console.error("Error increasing stock:", error);
    throw error;
  }
  return data as number;
};

export const createPembelian = async (data: {
  supplier_id: string;
  tanggal: string;
  no_do?: string;
  no_npb?: string;
  invoice?: string;
  metode_pembayaran: "Tunai" | "Transfer";
  nama_bank?: string;
  nama_pemilik_rekening?: string;
  nomor_rekening?: string;
  total: number;
  status: "Pending" | "Completed" | "Decline";
  items: PembelianDetailInput[];
}) => {
  const totalAmount = Number(data.total);
  assertValidMoney("Total pembelian", totalAmount);

  data.items.forEach((item, index) => {
    assertValidMoney(`Harga item #${index + 1}`, Number(item.harga));
    assertValidMoney(`Subtotal item #${index + 1}`, Number(item.subtotal));
  });
  if (data.metode_pembayaran === "Transfer") {
    if (!data.nama_bank || !data.nama_pemilik_rekening || !data.nomor_rekening) {
      throw new Error("Data transfer belum lengkap.");
    }
  }

  // Create pembelian record
  const pembelianData = {
    supplier_id: data.supplier_id,
    tanggal: data.tanggal,
    no_do: data.no_do,
    no_npb: data.no_npb,
    invoice: data.invoice,
    metode_pembayaran: data.metode_pembayaran,
    nama_bank: data.nama_bank,
    nama_pemilik_rekening: data.nama_pemilik_rekening,
    nomor_rekening: data.nomor_rekening,
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
      await increaseStock(item.supplier_produk_id, Number(item.qty));
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
    metode_pembayaran: item.metode_pembayaran || "Tunai",
    nama_bank: item.nama_bank || undefined,
    nama_pemilik_rekening: item.nama_pemilik_rekening || undefined,
    nomor_rekening: item.nomor_rekening || undefined,
    total: item.total,
    status: item.status,
    created_at: item.created_at,
    updated_at: item.updated_at,
    namaSupplier: item.suppliers?.nama || "Supplier Tidak Diketahui",
    items:
      (item.pembelian_detail as PembelianDetailRow[] | undefined)?.map((detail) => ({
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
    await increaseStock(detail.supplier_produk_id, Number(detail.qty));
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
