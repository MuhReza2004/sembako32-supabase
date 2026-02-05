import { supabase } from "../lib/supabase";
import { Produk, ProdukFormData } from "../types/produk";
import { v4 as uuidv4 } from 'uuid'; // For temporary kode generation

let produkCache: Produk[] | null = null;
let produkCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const invalidateProdukCache = () => {
  produkCache = null;
  produkCacheAt = 0;
};

/* =============================
   AUTO GENERATE ID PRODUK (Not directly needed for Supabase UUID primary keys)
   ============================= */
// Supabase automatically generates UUIDs for 'id' column.

/* =============================
   AUTO GENERATE KODE PRODUK
   ============================= */
export const generateKodeProduk = async (): Promise<string> => {
  // TODO: Implement proper sequential SKU generation using Supabase functions or a dedicated sequence table.
  // For now, generating a UUID to ensure uniqueness.
  return `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
};

export const getNewKodeProduk = async (): Promise<string> => {
  return await generateKodeProduk();
};

/* =============================
   CREATE
   ============================= */
export const addProduk = async (data: ProdukFormData): Promise<string> => {
  // 'id' and timestamps (created_at, updated_at) are handled by Supabase
  const { kode, nama, kategori, satuan, stok, status } = data;
  const { data: newProduk, error } = await supabase
    .from("produk")
    .insert({
      kode,
      nama,
      kategori,
      satuan,
      stok,
      status,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding produk:", error);
    throw error;
  }
  invalidateProdukCache();
  return newProduk.id;
};

/* =============================
   READ
   ============================= */
export const getAllProduk = async (
  options: { force?: boolean } = {},
): Promise<Produk[]> => {
  const now = Date.now();
  if (!options.force && produkCache && now - produkCacheAt < CACHE_TTL_MS) {
    return produkCache;
  }
  const { data, error } = await supabase
    .from("produk")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all produk:", error);
    return [];
  }
  produkCache = data as Produk[];
  produkCacheAt = now;
  return produkCache;
};

export const getProdukById = async (id: string): Promise<Produk | null> => {
  const { data, error } = await supabase
    .from("produk")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") { // No rows found
      return null;
    }
    console.error("Error fetching produk by ID:", error);
    throw error;
  }
  return data as Produk;
};

export const getProdukByName = async (nama: string): Promise<Produk | null> => {
  const { data, error } = await supabase
    .from("produk")
    .select("*")
    .eq("nama", nama)
    .single();

  if (error) {
    if (error.code === "PGRST116") { // No rows found
      return null;
    }
    console.error("Error fetching produk by name:", error);
    throw error;
  }
  return data as Produk;
};

/* =============================
   UPDATE & DELETE
   ============================= */
export const updateProduk = async (
  id: string,
  data: Partial<ProdukFormData>,
): Promise<void> => {
  const { error } = await supabase
    .from("produk")
    .update({ ...data })
    .eq("id", id);

  if (error) {
    console.error("Error updating produk:", error);
    throw error;
  }
  invalidateProdukCache();
};

export const updateProdukStok = async (
  id: string,
  newStok: number,
): Promise<void> => {
  const { error } = await supabase
    .from("produk")
    .update({ stok: newStok })
    .eq("id", id);

  if (error) {
    console.error("Error updating produk stock:", error);
    throw error;
  }
  invalidateProdukCache();
};

export const deleteProduk = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("produk")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting produk:", JSON.stringify(error, null, 2));
    throw error;
  }
  invalidateProdukCache();
};
