export type ProdukStatus = "aktif" | "nonaktif";

export interface ProdukFormData {
  kode: string; // Kode produk (SKU)
  nama: string; // Nama produk
  satuan: string; // Satuan (pcs, sak, kg, liter)
  kategori: string; // Kategori produk
  stok: number; // Jumlah stok awal
  status: ProdukStatus; // Status (aktif / nonaktif)
}

export interface Produk {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  status: ProdukStatus;
  created_at: string;
  updated_at: string;
}
