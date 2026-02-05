export default function StaffDashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Staff</h1>
        <p className="text-muted-foreground mt-1">
          Fokus pada transaksi penjualan dan pencetakan dokumen.
        </p>
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
