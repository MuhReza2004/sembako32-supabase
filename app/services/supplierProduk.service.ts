import { supabase } from "@/app/lib/supabase";
import { SupplierProduk, SupplierProdukFormData } from "@/app/types/supplier";

type SupplierProdukRow = SupplierProduk & {
  suppliers?: { nama?: string } | { nama?: string }[] | null;
  produk?: { nama?: string; satuan?: string } | { nama?: string; satuan?: string }[] | null;
};

let supplierProdukCache: SupplierProduk[] | null = null;
let supplierProdukCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const invalidateSupplierProdukCache = () => {
  supplierProdukCache = null;
  supplierProdukCacheAt = 0;
};

/* ======================
   CREATE
====================== */
export const addSupplierProduk = async (
  data: SupplierProdukFormData,
): Promise<string> => {
  const { data: result, error } = await supabase
    .from("supplier_produk")
    .insert({
      supplier_id: data.supplier_id,
      produk_id: data.produk_id,
      harga_beli: data.harga_beli,
      harga_jual: data.harga_jual,
      stok: data.stok,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding supplier produk:", error);
    throw error;
  }

  invalidateSupplierProdukCache();
  return result.id;
};

/* ======================
   READ
====================== */
export const getAllSupplierProduk = async (
  options: { force?: boolean } = {},
): Promise<SupplierProduk[]> => {
  const now = Date.now();
  if (
    !options.force &&
    supplierProdukCache &&
    now - supplierProdukCacheAt < CACHE_TTL_MS
  ) {
    return supplierProdukCache;
  }
  const { data, error } = await supabase
    .from("supplier_produk")
    .select(
      `
      id,
      supplier_id,
      produk_id,
      harga_beli,
      harga_jual,
      stok,
      created_at,
      suppliers (
        id,
        nama
      ),
      produk (
        id,
        nama,
        satuan
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching supplier produk:", error);
    throw error;
  }

  supplierProdukCache = (data as SupplierProdukRow[]).map((item) => {
    const supplierRaw = Array.isArray(item.suppliers)
      ? item.suppliers[0]
      : item.suppliers;
    const produkRaw = Array.isArray(item.produk) ? item.produk[0] : item.produk;
    return {
      id: item.id,
      supplier_id: item.supplier_id,
      produk_id: item.produk_id,
      harga_beli: item.harga_beli,
      harga_jual: item.harga_jual,
      stok: item.stok,
      created_at: item.created_at, // Use as string
      supplierNama: supplierRaw?.nama,
      produkNama: produkRaw?.nama,
      produkSatuan: produkRaw?.satuan,
    };
  });
  supplierProdukCacheAt = now;
  return supplierProdukCache;
};

export const getSupplierProdukById = async (
  id: string,
): Promise<SupplierProduk | null> => {
  const { data, error } = await supabase
    .from("supplier_produk")
    .select(
      `
      id,
      supplier_id,
      produk_id,
      harga_beli,
      harga_jual,
      stok,
      created_at,
      suppliers (
        id,
        nama
      ),
      produk (
        id,
        nama,
        satuan
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching supplier produk by id:", error);
    return null;
  }

  const row = data as SupplierProdukRow;
  const supplierRaw = Array.isArray(row.suppliers)
    ? row.suppliers[0]
    : row.suppliers;
  const produkRaw = Array.isArray(row.produk) ? row.produk[0] : row.produk;
  return {
    id: data.id,
    supplier_id: data.supplier_id,
    produk_id: data.produk_id,
    harga_beli: data.harga_beli,
    harga_jual: data.harga_jual,
    stok: data.stok,
    created_at: data.created_at, // Use as string
    supplierNama: supplierRaw?.nama,
    produkNama: produkRaw?.nama,
    produkSatuan: produkRaw?.satuan,
  };
};

/* ======================
   UPDATE
====================== */
export const updateSupplierProduk = async (
  id: string,
  data: Partial<SupplierProdukFormData>,
): Promise<void> => {
  const updateData: Partial<SupplierProdukFormData> = {};
  if (data.harga_beli !== undefined) updateData.harga_beli = data.harga_beli;
  if (data.harga_jual !== undefined) updateData.harga_jual = data.harga_jual;
  if (data.stok !== undefined) updateData.stok = data.stok;

  const { error } = await supabase
    .from("supplier_produk")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error updating supplier produk:", error);
    throw error;
  }
  invalidateSupplierProdukCache();
};

/* ======================
   DELETE
====================== */
export const deleteSupplierProduk = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("supplier_produk")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting supplier produk:", error.message || error);
    throw error;
  }
  invalidateSupplierProdukCache();
};

/* ======================
   VALIDATION
====================== */
export const checkSupplierProdukExists = async (
  supplierId: string,
  produkId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("supplier_produk")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("produk_id", produkId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking supplier produk exists:", error);
    return false;
  }

  return !!data;
};
