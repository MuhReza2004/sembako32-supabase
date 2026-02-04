import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data: produkData, error: produkError } = await supabaseAdmin
      .from("produk")
      .select("*");
    if (produkError) throw produkError;

    const { data: supplierProdukData, error: supplierProdukError } =
      await supabaseAdmin.from("supplier_produk").select("*");
    if (supplierProdukError) throw supplierProdukError;

    const { data: pembelianData, error: pembelianError } = await supabaseAdmin
      .from("pembelian")
      .select("*, items:pembelian_detail(*)")
      .eq("status", "Completed");
    if (pembelianError) throw pembelianError;

    const { data: penjualanData, error: penjualanError } = await supabaseAdmin
      .from("penjualan")
      .select("*, items:penjualan_detail(*)")
      .neq("status", "Batal");
    if (penjualanError) throw penjualanError;

    const inventory = produkData.map((p) => {
      const relatedSupplierProduk = supplierProdukData.filter(
        (sp: any) => sp.produk_id === p.id,
      );

      const totalMasuk = (pembelianData || []).reduce(
        (sum: number, beli: any) => {
          return (
            sum +
            (beli.items || []).reduce((itemSum: number, item: any) => {
              const isRelated = relatedSupplierProduk.some(
                (sp) => sp.id === item.supplier_produk_id,
              );
              return isRelated ? itemSum + item.qty : itemSum;
            }, 0)
          );
        },
        0,
      );

      const totalKeluar = (penjualanData || []).reduce(
        (sum: number, jual: any) => {
          return (
            sum +
            (jual.items || []).reduce((itemSum: number, item: any) => {
              const isRelated = relatedSupplierProduk.some(
                (sp) => sp.id === item.supplier_produk_id,
              );
              return isRelated ? itemSum + item.qty : itemSum;
            }, 0)
          );
        },
        0,
      );

      const currentStok = relatedSupplierProduk.reduce(
        (sum: number, sp: any) => sum + (sp.stok || 0),
        0,
      );

      return { ...p, stok: currentStok, totalMasuk, totalKeluar };
    });

    return NextResponse.json(inventory);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return new NextResponse(
      JSON.stringify({ error: "Gagal memuat data inventory: " + errorMessage }),
      { status: 500 },
    );
  }
}
