"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { InventoryTable } from "@/components/barang/InventoryTable";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { Produk } from "@/app/types/produk";
import { Pembelian } from "@/app/types/pembelian";
import { Penjualan } from "@/app/types/penjualan";
import { SupplierProduk } from "@/app/types/suplyer"; // Assuming SupplierProduk is needed directly

export interface InventoryData extends Produk {
  totalMasuk: number;
  totalKeluar: number;
}

export default function InventoryPage() {
  const [produk, setProduk] = useState<Produk[]>([]);
  const [supplierProduk, setSupplierProduk] = useState<SupplierProduk[]>([]);
  const [pembelian, setPembelian] = useState<Pembelian[]>([]);
  const [penjualan, setPenjualan] = useState<Penjualan[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch Produk
      const { data: produkData, error: produkError } = await supabase
        .from("produk")
        .select("*");
      if (produkError) throw produkError;
      setProduk(produkData as Produk[]);

      // Fetch Supplier Produk
      const { data: supplierProdukData, error: supplierProdukError } = await supabase
        .from("supplier_produk")
        .select("*");
      if (supplierProdukError) throw supplierProdukError;
      setSupplierProduk(supplierProdukData as SupplierProduk[]);

      // Fetch Pembelian with details
      const { data: pembelianData, error: pembelianError } = await supabase
        .from("pembelian")
        .select(`
          *,
          items:pembelian_detail(*)
        `); // Fetch details directly
      if (pembelianError) throw pembelianError;
      setPembelian(pembelianData as Pembelian[]);

      // Fetch Penjualan with details
      const { data: penjualanData, error: penjualanError } = await supabase
        .from("penjualan")
        .select(`
          *,
          items:penjualan_detail(*)
        `); // Fetch details directly
      if (penjualanError) throw penjualanError;
      setPenjualan(penjualanData as Penjualan[]);
    } catch (err: any) {
      setError("Gagal memuat data inventory: " + err.message);
      console.error("Error fetching inventory data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array means this function is created once

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('inventory-changes');

    const tables = ['produk', 'supplier_produk', 'pembelian', 'pembelian_detail', 'penjualan', 'penjualan_detail'];

    tables.forEach(table => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, payload => {
            console.log(`Change detected in ${table}`, payload);
            fetchData();
        }).subscribe();
    });

    return () => {
        supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    if (produk.length > 0 && supplierProduk.length > 0) {
      setIsLoading(true);
      const inventory: InventoryData[] = produk.map((p) => {
        // Find all supplier products for this product
        const relatedSupplierProduk = supplierProduk.filter(
          (sp) => sp.produk_id === p.id, // Use snake_case
        );

        const totalMasuk = pembelian.reduce((sum, beli) => {
          return (
            sum +
            (beli.items || []).reduce((itemSum, item) => {
              // Check if this item belongs to any supplier product for this product
              const isRelated = relatedSupplierProduk.some(
                (sp) => sp.id === item.supplier_produk_id, // Use snake_case
              );
              return isRelated ? itemSum + item.qty : itemSum;
            }, 0)
          );
        }, 0);

        const totalKeluar = penjualan.reduce((sum, jual) => {
          return (
            sum +
            (jual.items || []).reduce((itemSum, item) => {
              // Check if this item belongs to any supplier product for this product
              const isRelated = relatedSupplierProduk.some(
                (sp) => sp.id === item.supplier_produk_id, // Use snake_case
              );
              return isRelated ? itemSum + item.qty : itemSum;
            }, 0)
          );
        }, 0);

        // Calculate current stock as sum of all supplier product stocks
        const currentStok = relatedSupplierProduk.reduce(
          (sum, sp) => sum + (sp.stok || 0),
          0,
        );

        return { ...p, stok: currentStok, totalMasuk, totalKeluar };
      });
      setInventoryData(inventory);
      setIsLoading(false);
    }
  }, [produk, supplierProduk, pembelian, penjualan]);

  const filteredData = useMemo(
    () =>
      inventoryData.filter(
        (p) =>
          p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.kode.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [inventoryData, searchTerm],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Laporan Inventory</h1>
        <p className="mt-2 text-gray-600">
          Laporan stok masuk, stok keluar, dan stok akhir setiap produk.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Cari kode atau nama produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <InventoryTable inventoryData={filteredData} isLoading={isLoading} />
    </div>
  );
}