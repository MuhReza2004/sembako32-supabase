"use client";

import { useRouter } from "next/navigation";
import PembelianForm from "@/components/pembelian/pembelianForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PageTambahPembelian() {
  const router = useRouter();

  const handleFormSuccess = () => {
    router.push("/dashboard/admin/transaksi/pembelian");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tambah Transaksi Pembelian</h1>
            <p className="text-muted-foreground mt-1">
              Buat transaksi pembelian baru dari supplier
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <PembelianForm onSuccess={handleFormSuccess} />
        </div>
      </div>
    </div>
  );
}
