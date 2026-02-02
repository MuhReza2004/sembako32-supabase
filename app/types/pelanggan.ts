export interface PelangganFormData {
  nama_pelanggan: string;
  kode_pelanggan: string;
  nama_toko: string;
  nib?: string;
  alamat: string;
  no_telp: string;
  email?: string;
  status: "aktif" | "nonaktif";
}

export interface Pelanggan {
  id: string;
  id_pelanggan: string; // The auto-generated PLG-xxxxx
  kode_pelanggan: string;
  nama_pelanggan: string;
  nama_toko: string;
  nib: string;
  alamat: string;
  no_telp: string;
  email?: string;
  status: "aktif" | "nonaktif";
  created_at: string;
  updated_at: string;
}
