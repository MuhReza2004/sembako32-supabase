# Edit tanggal transaksi penjualan

Admin dapat mengubah tanggal melalui Detail Penjualan di menu Transaksi dan Laporan Penjualan. Simpan tanggal memperbarui daftar dan detail. Staff tetap hanya dapat melihat.

Invoice, DO, tanda terima, BAST, dan ekspor gabungan membaca `penjualan.tanggal` dari database saat cetak. PDF yang sudah diunduh harus dicetak ulang. Nomor dokumen, stok, nominal, tanggal jatuh tempo, riwayat pembayaran dan tanggal pengiriman/penerimaan tidak diubah. Perubahan tanggal memindahkan transaksi pada filter tanggal dan perhitungan laporan periode.

Sebelum deploy, jalankan `sql/migrations/20261103_edit_tanggal_penjualan.sql` melalui Supabase SQL Editor (setelah migrasi 20260930d). RPC hanya dapat digunakan admin/service role, memvalidasi tanggal dan menolak ID tidak ditemukan. Tidak ada migrasi data historis.

Verifikasi lokal: `node tests/transaction-date.mjs`, `npx tsc --noEmit --incremental false`, ESLint file berubah. Uji database dan browser tetap diperlukan: sebagai admin ubah transaksi ke bulan lain, buka ulang detail, cetak invoice/DO/tanda terima/BAST/semua dokumen dan cek tanggal; pastikan nomor tetap dan laporan berpindah periode. Staff/anon harus ditolak saat memanggil RPC, tanggal kosong/tidak valid serta ID tidak ditemukan harus gagal.

Rollback aplikasi ke versi sebelumnya untuk menyembunyikan editor. RPC boleh tetap ada; tanggal yang telah diedit tidak dikembalikan otomatis.

Hasil lokal: TypeScript lulus; self-check validasi/RPC/pemetaan PDF lulus; PostgreSQL 15 Docker terisolasi lulus untuk edit admin, penolakan staff/anon, tanggal kosong dan ID tidak ditemukan, serta nomor dokumen tetap. ESLint aplikasi hanya memiliki 4 warning unused yang sudah ada. Belum diuji melalui browser atau terhadap skema database lengkap/production.
