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
  metode_pembayaran: "Tunai" | "Transfer";
  nama_bank?: string;
  nama_pemilik_rekening?: string;
  nomor_rekening?: string;
  total: number;
  status: "Pending" | "Completed" | "Decline";
  created_at: string;
  updated_at: string;
  items?: PembelianDetail[]; // populated from pembelian_detail
  namaSupplier?: string; // Added for supplier name
}

export type PembelianFormItem = Omit<
  PembelianDetail,
  "id" | "pembelian_id" | "created_at"
>;
export type PembelianFormData = Omit<
  Pembelian,
  "id" | "created_at" | "updated_at" | "items"
> & {
  items?: PembelianFormItem[];
};
