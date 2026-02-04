export type DeliveryOrderStatus = "Draft" | "Dikirim" | "Diterima" | "Batal";

export interface DeliveryOrder {
  id: string;
  penjualan_id: string;
  no_do: string;
  no_tanda_terima?: string;
  status: DeliveryOrderStatus;
  tanggal_kirim?: string;
  tanggal_terima?: string;
  alamat_pengiriman?: string;
  catatan?: string;
  created_at: string;
  updated_at: string;
}
