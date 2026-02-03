import { supabase } from "@/app/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data: produkData, error: produkError } = await supabase
      .from("produk")
      .select("*");
    if (produkError) throw produkError;

    const { data: supplierProdukData, error: supplierProdukError } =
      await supabase.from("supplier_produk").select("*");
    if (supplierProdukError) throw supplierProdukError;

    const { data: pembelianData, error: pembelianError } = await supabase
      .from("pembelian")
      .select("*, items:pembelian_detail(*)");
    if (pembelianError) throw pembelianError;

    const { data: penjualanData, error: penjualanError } = await supabase
      .from("penjualan")
      .select("*, items:penjualan_detail(*)");
    if (penjualanError) throw penjualanError;

    const inventory = produkData.map((p) => {
      const relatedSupplierProduk = supplierProdukData.filter(
        (sp) => sp.produk_id === p.id,
      );

      const totalMasuk = (pembelianData || []).reduce((sum, beli) => {
        return (
          sum +
          (beli.items || []).reduce((itemSum, item) => {
            const isRelated = relatedSupplierProduk.some(
              (sp) => sp.id === item.supplier_produk_id,
            );
            return isRelated ? itemSum + item.qty : itemSum;
          }, 0)
        );
      }, 0);

      const totalKeluar = (penjualanData || []).reduce((sum, jual) => {
        return (
          sum +
          (jual.items || []).reduce((itemSum, item) => {
            const isRelated = relatedSupplierProduk.some(
              (sp) => sp.id === item.supplier_produk_id,
            );
            return isRelated ? itemSum + item.qty : itemSum;
          }, 0)
        );
      }, 0);

      const currentStok = relatedSupplierProduk.reduce(
        (sum, sp) => sum + (sp.stok || 0),
        0,
      );

      return { ...p, stok: currentStok, totalMasuk, totalKeluar };
    });

    return NextResponse.json(inventory);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return new NextResponse(
      JSON.stringify({ error: "Gagal memuat data inventory: " + errorMessage }),
      { status: 500 },
    );
  }
}
