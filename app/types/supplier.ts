export interface SupplierFormData {
  kode: string;
  nama: string;
  alamat: string;
  telp: string;
  status: boolean;
}

export interface Supplier extends SupplierFormData {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierProduk {
  id: string;
  supplier_id: string;
  produk_id: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  created_at: string;
  supplierNama?: string;
  produkNama?: string;
  produkSatuan?: string;
}

export interface SupplierProdukFormData {
  supplier_id: string;
  produk_id: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
}
