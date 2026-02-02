import { supabase } from "@/app/lib/supabase";
import { SupplierProduk, SupplierProdukFormData } from "@/app/types/suplyer";

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

  return result.id;
};

/* ======================
   READ
====================== */
export const getAllSupplierProduk = async (): Promise<SupplierProduk[]> => {
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

  return data.map((item) => ({
    id: item.id,
    supplier_id: item.supplier_id,
    produk_id: item.produk_id,
    harga_beli: item.harga_beli,
    harga_jual: item.harga_jual,
    stok: item.stok,
    created_at: item.created_at, // Use as string
    supplierNama: item.suppliers?.nama,
    produkNama: item.produk?.nama,
    produkSatuan: item.produk?.satuan,
  }));
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

  return {
    id: data.id,
    supplier_id: data.supplier_id,
    produk_id: data.produk_id,
    harga_beli: data.harga_beli,
    harga_jual: data.harga_jual,
    stok: data.stok,
    created_at: data.created_at, // Use as string
    supplierNama: data.suppliers?.nama,
    produkNama: data.produk?.nama,
    produkSatuan: data.produk?.satuan,
  };
};

/* ======================
   UPDATE
====================== */
export const updateSupplierProduk = async (
  id: string,
  data: Partial<SupplierProdukFormData>,
): Promise<void> => {
  const updateData: any = {};
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
    console.error("Error deleting supplier produk:", error);
    throw error;
  }
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
