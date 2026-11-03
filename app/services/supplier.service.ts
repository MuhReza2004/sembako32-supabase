import { supabase } from "../lib/supabase";
import { Supplier, SupplierFormData } from "@/app/types/supplier";

let supplierCache: Supplier[] | null = null;
let supplierCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const invalidateSupplierCache = () => {
  supplierCache = null;
  supplierCacheAt = 0;
};

// Kode dari sequence DB (F-25): aman untuk >999 supplier dan dua admin
// yang menambah bersamaan.
const generateSupplierCode = async (): Promise<string> => {
  const { data, error } = await supabase.rpc("generate_supplier_code");
  if (error || !data) {
    throw new Error(error?.message || "Gagal membuat kode supplier");
  }
  return data as string;
};

/* ======================
   CREATE
====================== */
export const addSupplier = async (
  data: Omit<SupplierFormData, "kode">,
): Promise<string> => {
  const { data: existingSupplier, error: existingError } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("nama", data.nama)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingSupplier) {
    throw new Error("Nama supplier sudah terdaftar.");
  }

  const kode = await generateSupplierCode();

  const { data: newSupplier, error } = await supabase
    .from("suppliers")
    .insert({
      ...data,
      kode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding supplier:", error);
    throw error;
  }
  invalidateSupplierCache();
  return newSupplier.id;
};

/* ======================
   READ
====================== */
export const getAllSuppliers = async (
  options: { force?: boolean } = {},
): Promise<Supplier[]> => {
  const now = Date.now();
  if (!options.force && supplierCache && now - supplierCacheAt < CACHE_TTL_MS) {
    return supplierCache;
  }
  const { data, error } = await supabase
    .from("suppliers")
    .select("*");

  if (error) {
    console.error("Error fetching all suppliers:", error);
    return [];
  }
  supplierCache = data as Supplier[];
  supplierCacheAt = now;
  return supplierCache;
};

export const getSupplierById = async (id: string): Promise<Supplier | null> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") { // No rows found
      return null;
    }
    console.error("Error fetching supplier by ID:", error);
    throw error;
  }
  return data as Supplier;
};

/* ======================
   UPDATE
====================== */
export const updateSupplier = async (
  id: string,
  data: Partial<SupplierFormData>,
): Promise<void> => {
  const { error } = await supabase
    .from("suppliers")
    .update({ ...data })
    .eq("id", id);

  if (error) {
    console.error("Error updating supplier:", error);
    throw error;
  }
  invalidateSupplierCache();
};

/* ======================
   DELETE
====================== */
export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting supplier:", error);
    // 23503 = foreign_key_violation: data masih dirujuk transaksi (FK RESTRICT).
    if (error.code === "23503") {
      throw new Error(
        "Supplier ini sudah dipakai di transaksi pembelian/penjualan sehingga tidak bisa dihapus. Nonaktifkan supplier ini.",
      );
    }
    throw error;
  }
  invalidateSupplierCache();
};
