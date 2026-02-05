"use client";

import { useEffect, useState } from "react";
import { PenjualanForm } from "@/components/penjualan/PenjualanForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Produk } from "@/app/types/produk";
import { SupplierProduk } from "@/app/types/supplier";
import { Pelanggan } from "@/app/types/pelanggan";

type ProdukOption = Pick<Produk, "id" | "nama" | "satuan">;
type PelangganOption = Pick<
  Pelanggan,
  "id" | "nama_pelanggan" | "kode_pelanggan" | "nama_toko"
>;
type SupplierProdukOption = Pick<
  SupplierProduk,
  "id" | "supplier_id" | "produk_id" | "harga_jual_normal" | "harga_jual_grosir" | "stok"
> & { produk?: ProdukOption | ProdukOption[] };

export default function PageTambahPenjualanStaff() {
  const [products, setProducts] = useState<ProdukOption[]>([]);
  const [supplierProduks, setSupplierProduks] = useState<SupplierProdukOption[]>(
    [],
  );
  const [pelangganList, setPelangganList] = useState<PelangganOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: productsData, error: productsError }, { data: supplierProdukData, error: supplierProdukError }, { data: pelangganData, error: pelangganError }] =
          await Promise.all([
            supabase
              .from("produk")
              .select("id, nama, satuan")
              .order("nama", { ascending: true }),
            supabase
              .from("supplier_produk")
              .select(
                "id, supplier_id, produk_id, harga_jual, harga_jual_normal, harga_jual_grosir, stok, produk (id, nama, satuan)",
              ),
            supabase.from("pelanggan").select("id, nama_pelanggan, kode_pelanggan, nama_toko"),
          ]);

        if (productsError || supplierProdukError || pelangganError) {
          throw new Error("Gagal memuat data master untuk penjualan.");
        }

        setProducts((productsData as ProdukOption[]) || []);
        setSupplierProduks((supplierProdukData as SupplierProdukOption[]) || []);
        setPelangganList((pelangganData as PelangganOption[]) || []);

      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <Link href="/dashboard/staff/transaksi/penjualan">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Tambah Transaksi Penjualan</h1>
            <p className="text-muted-foreground mt-1">
              Buat transaksi penjualan baru.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {loading && <div className="p-8 text-center">Loading form...</div>}
          {error && (
            <div className="p-8 text-center text-red-500">{error}</div>
          )}
          {!loading && !error && (
            <PenjualanForm
              products={products}
              supplierProduks={supplierProduks}
              pelangganList={pelangganList}
            />
          )}
        </div>
      </div>
    </div>
  );
}
