export interface PembelianDetail {
  id: string;
  pembelian_id: string;
  supplier_produk_id: string;
  qty: number;
  harga: number;
  subtotal: number;
  namaProduk?: string; // Added for product name
  satuan?: string; // Added for product unit
  created_at: string;
}

export interface Pembelian {
  id: string;
  supplier_id: string;
  tanggal: string;
  no_do?: string;
  no_npb?: string;
  invoice?: string;
  total: number;
  status: "Pending" | "Completed" | "Decline";
  created_at: string;
  updated_at: string;
  items?: PembelianDetail[]; // populated from pembelian_detail
  namaSupplier?: string; // Added for supplier name
}
