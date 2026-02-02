import { Produk } from "./produk";

export interface InventoryData extends Produk {
  totalMasuk: number;
  totalKeluar: number;
}

export interface StockAdjustment {
  id: string;
  produk_id: string;
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: string;
  created_at: string;
  created_by: string;
}

export interface LowStockAlert {
  produk_id: string;
  nama: string;
  current_stock: number;
  min_stock: number;
}
