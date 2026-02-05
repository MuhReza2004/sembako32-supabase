import { supabaseAdmin } from "@/lib/supabase-admin";
import { PenjualanForm } from "@/components/penjualan/PenjualanForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";

async function TambahPenjualanDataLoader({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const editId = searchParams.id;

  const { data: products, error: productsError } = await supabaseAdmin
    .from("produk")
    .select("*")
    .order("nama", { ascending: true });

  const { data: supplierProduks, error: supplierProduksError } =
    await supabaseAdmin.from("supplier_produk").select("*, produk(*)");

  const { data: pelangganList, error: pelError } = await supabaseAdmin
    .from("pelanggan")
    .select("*");

  let editingPenjualan = null;
  if (editId) {
    const { data, error } = await supabaseAdmin
      .from("penjualan")
      .select("*, penjualan_detail(*)")
      .eq("id", editId)
      .single();
    if (error) {
      console.error("Error fetching penjualan for edit:", error);
    } else {
      editingPenjualan = data;
    }
  }

  if (productsError || supplierProduksError || pelError) {
    return (
      <div className="p-8 text-center text-red-500">
        Gagal memuat data yang dibutuhkan untuk form penjualan.
      </div>
    );
  }

  return (
    <PenjualanForm
      products={products || []}
      supplierProduks={supplierProduks || []}
      pelangganList={pelangganList || []}
      editingPenjualan={editingPenjualan}
    />
  );
}

export default function PageTambahPenjualan({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <Link href="/dashboard/admin/transaksi/penjualan">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {searchParams.id ? "Edit" : "Tambah"} Transaksi Penjualan
            </h1>
            <p className="text-muted-foreground mt-1">
              {searchParams.id
                ? "Perbarui detail transaksi penjualan."
                : "Buat transaksi penjualan baru."}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <Suspense
            fallback={<div className="p-8 text-center">Loading form...</div>}
          >
            <TambahPenjualanDataLoader searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
