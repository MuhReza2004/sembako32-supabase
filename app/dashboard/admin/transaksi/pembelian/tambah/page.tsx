import { supabaseAdmin } from "@/lib/supabase-admin";
import PembelianForm from "@/components/pembelian/pembelianForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function PageTambahPembelian() {
  const { data: suppliers, error: suppliersError } = await supabaseAdmin
    .from("suppliers")
    .select("*")
    .order("nama", { ascending: true });
  const { data: products, error: productsError } = await supabaseAdmin
    .from("produk")
    .select("*")
    .order("nama", { ascending: true });
  const { data: supplierProduks, error: supplierProduksError } =
    await supabaseAdmin.from("supplier_produk").select("*");

  console.log("Suppliers fetched:", suppliers);
  console.log("Suppliers error:", suppliersError);
  console.log("Products fetched:", products?.length || 0);
  console.log("Supplier Products fetched:", supplierProduks?.length || 0);

  if (suppliersError || productsError || supplierProduksError) {
    return (
      <div className="p-8 text-center text-red-500">
        Gagal memuat data yang dibutuhkan untuk form pembelian.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <Link href="/dashboard/admin/transaksi/pembelian">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Tambah Transaksi Pembelian</h1>
            <p className="text-muted-foreground mt-1">
              Buat transaksi pembelian baru dari supplier
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <PembelianForm
            suppliers={suppliers || []}
            products={products || []}
            supplierProduks={supplierProduks || []}
          />
        </div>
      </div>
    </div>
  );
}
