export interface PenjualanDetail {
  id: string;
  penjualan_id: string;
  supplier_produk_id: string;
  qty: number;
  harga: number;
  subtotal: number;
  // Additional fields for display
  namaProduk?: string;
  satuan?: string;
  hargaJual?: number;
  created_at: string;
}

export interface RiwayatPembayaran {
  id: string;
  penjualan_id: string;
  tanggal: string;
  jumlah: number;
  metode_pembayaran: string;
  atas_nama: string;
  created_at: string;
}

export interface Penjualan {
  id: string;
  tanggal: string;
  pelanggan_id: string;
  catatan?: string;
  no_invoice: string;
  no_npb: string; // Nomor Pengambilan Barang
  no_do?: string; // Nomor Delivery Order
  no_tanda_terima?: string; // Nomor Tanda Terima
  metode_pengambilan: "Ambil Langsung" | "Diantar";
  total: number;
  total_dibayar?: number; // Total amount paid
  status: "Lunas" | "Belum Lunas" | "Batal";
  riwayatPembayaran?: RiwayatPembayaran[]; // Payment history
  created_at: string;
  updated_at: string;
  created_by?: string;
  createdByEmail?: string;
  createdByRole?: string;
  items?: PenjualanDetail[]; // populated from penjualan_detail

  // Additional fields for detailed view
  nomorInvoice?: string; // alias for noInvoice
  namaPelanggan?: string;
  alamatPelanggan?: string;
  metode_pembayaran?: string;
  nomor_rekening?: string;
  nama_bank?: string;
  nama_pemilik_rekening?: string;
  tanggal_jatuh_tempo?: string;
  diskon?: number;
  pajak_enabled?: boolean;
  pajak?: number;
  total_akhir?: number;
}

export type PenjualanFormItem = Omit<
  PenjualanDetail,
  "id" | "penjualan_id" | "created_at"
>;
export type PenjualanFormData = Omit<
  Penjualan,
  "id" | "created_at" | "updated_at" | "items"
> & {
  items?: PenjualanFormItem[];
};
