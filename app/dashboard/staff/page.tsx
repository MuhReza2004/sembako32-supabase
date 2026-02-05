"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/helper/format";
import { getPenjualanSummaryForCurrentUser } from "@/app/services/penjualan.service";

export default function StaffDashboardPage() {
  const [summary, setSummary] = useState<{
    totalHariIni: number;
    jumlahHariIni: number;
    belumLunas: number;
    batal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getPenjualanSummaryForCurrentUser();
        setSummary(data);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Staff</h1>
        <p className="text-muted-foreground mt-1">
          Fokus pada transaksi penjualan dan pencetakan dokumen.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Penjualan Hari Ini</div>
          <div className="text-2xl font-semibold">
            {loading ? "..." : summary?.jumlahHariIni ?? 0}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Hari Ini</div>
          <div className="text-2xl font-semibold">
            {loading ? "..." : formatRupiah(summary?.totalHariIni ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Belum Lunas</div>
          <div className="text-2xl font-semibold">
            {loading ? "..." : summary?.belumLunas ?? 0}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Transaksi Batal</div>
          <div className="text-2xl font-semibold">
            {loading ? "..." : summary?.batal ?? 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/dashboard/staff/transaksi/penjualan/tambah"
          className="rounded-xl border bg-card p-5 hover:border-primary/60 transition-colors"
        >
          <div className="text-lg font-semibold">Buat Penjualan</div>
          <div className="text-sm text-muted-foreground mt-1">
            Input transaksi penjualan baru.
          </div>
        </a>

        <a
          href="/dashboard/staff/transaksi/penjualan"
          className="rounded-xl border bg-card p-5 hover:border-primary/60 transition-colors"
        >
          <div className="text-lg font-semibold">Daftar Penjualan</div>
          <div className="text-sm text-muted-foreground mt-1">
            Lihat transaksi milik Anda dan cetak dokumen.
          </div>
        </a>
      </div>
    </div>
  );
}
