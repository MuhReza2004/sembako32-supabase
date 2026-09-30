# 2026-09-30 — Perbaikan Integritas Data Prioritas Tinggi (F-05, F-06, F-11, F-12, F-19)

Lanjutan dari [2026-09-30-fix-critical-security.md](2026-09-30-fix-critical-security.md). Referensi temuan: [docs/FINDINGS.md](../FINDINGS.md).

## Ringkasan

| ID | Masalah | Perbaikan |
|---|---|---|
| F-05 | Pembelian yang sudah `Completed` bisa di-"Terima" lagi → stok bertambah dua kali. | RPC atomik `receive_pembelian` (hanya Pending) dan `decline_pembelian`. Tombol Terima nonaktif untuk non-Pending. |
| F-06 | Menghapus pelanggan/supplier/produk/harga produk ikut menghapus histori penjualan & pembelian (`ON DELETE CASCADE`). | FK transaksi diubah ke `ON DELETE RESTRICT`. Aplikasi menampilkan pesan untuk menonaktifkan data. |
| F-11 | Skrip `setval` membaca bagian nomor NPB/DO yang salah → bisa menghasilkan nomor duplikat. | Indeks dikoreksi. `update-schema.sql` ditandai usang. |
| F-12 | Setelah menyimpan penjualan, staff diarahkan ke halaman admin. | `PenjualanForm` menerima `redirectTo`; staff diarahkan ke daftar penjualan staff. |
| F-19 | Kolom harga/subtotal/pembayaran `DECIMAL(10,2)` → transaksi ≥ Rp100 juta gagal disimpan. | Diubah ke `DECIMAL(14,2)`. |

## Perubahan perilaku yang terlihat pengguna

- **Pembelian**
  - Tombol **Terima** hanya aktif untuk pembelian berstatus Pending.
  - Pembelian Completed masih bisa **Ditolak**. Stok yang sudah masuk dikurangi kembali, dan konfirmasi sekarang menjelaskan hal itu.
  - Jika stok itu sudah terjual sebagian, penolakan gagal utuh dengan pesan "Stok … sudah terpakai" dan tidak ada data yang berubah.
- **Hapus data master**: pelanggan, supplier, produk, atau harga produk yang **sudah pernah dipakai transaksi tidak bisa dihapus**. Muncul pesan untuk mengubah status menjadi nonaktif. Data yang belum pernah dipakai tetap bisa dihapus seperti biasa.
- **Staff**: setelah menyimpan penjualan langsung kembali ke *Transaksi → Penjualan* milik staff.
- **Nominal besar**: harga produk dan pembayaran piutang di atas Rp99.999.999 kini bisa disimpan.

## File yang berubah

**Database**
- `sql/migrations/20260930b_fix_high_priority_data.sql` (baru). Isinya:
  - F-19: kolom uang ke `DECIMAL(14,2)`.
  - F-06: FK ke `RESTRICT`. Nama constraint dicari dari katalog, jadi aman meskipun nama di production berbeda.
  - F-05: RPC `receive_pembelian`, `decline_pembelian`.
  - Idempoten, dibungkus `BEGIN`/`COMMIT`.
- `supabase-schema.sql`, `update-schema.sql`: indeks `setval` NPB (6) dan DO (5). `update-schema.sql` diberi peringatan **usang, jangan dijalankan**.

**Aplikasi**
- `app/services/pembelian.service.ts`: `updatePembelianAndStock` → `rpc("receive_pembelian")`; `updatePembelianStatus("Decline")` → `rpc("decline_pembelian")`; helper `decreaseStock` yang tidak terpakai dihapus.
- `components/pembelian/DialogEditPembelian.tsx`: tombol Terima nonaktif untuk non-Pending; pesan konfirmasi Tolak.
- `app/services/{pelanggan,supplier,produk,supplierProduk}.service.ts`: error `23503` → pesan ramah.
- `components/penjualan/PenjualanForm.tsx` (prop `redirectTo`), `app/dashboard/staff/transaksi/penjualan/tambah/page.tsx`.

**Dokumentasi**: `docs/FINDINGS.md` (status), `docs/ARCHITECTURE.md` (alur pembelian, aturan hapus), `CLAUDE.md` (penamaan migrasi).

## Langkah deploy

Urutannya sama seperti sebelumnya: **migrasi dulu, baru deploy kode**.

1. Pastikan migrasi sebelumnya (`20260930_fix_critical_security.sql`) sudah ada di project **production** (`dwdgixftljajyafeljpc`), karena RPC baru memakai `is_admin()` dan `is_service_role()` dari migrasi tersebut.
2. Jalankan `sql/migrations/20260930b_fix_high_priority_data.sql` di SQL Editor project production.
   - Jika muncul error `cannot alter type of a column used by a view or rule`, ada view di production yang tidak tercatat di repo. Kirimkan pesan error-nya. Transaksi otomatis dibatalkan, tidak ada yang berubah.
3. Verifikasi:
   ```sql
   -- FK harus 'r' (RESTRICT) untuk 4 baris pertama
   SELECT conrelid::regclass::text AS tabel, conname, confdeltype::text AS on_delete
   FROM pg_constraint
   WHERE contype = 'f'
     AND conrelid::regclass::text IN ('penjualan','pembelian','penjualan_detail','pembelian_detail')
   ORDER BY 1;

   -- Harus kosong (tidak ada kolom uang < 14 digit)
   SELECT table_name, column_name, numeric_precision FROM information_schema.columns
   WHERE table_schema = 'public' AND data_type = 'numeric' AND numeric_precision < 14;

   -- Harus berisi receive_pembelian & decline_pembelian
   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE '%_pembelian';
   ```
4. Push & deploy kode.

Selama migrasi sudah jalan tapi kode belum dideploy, tidak ada fitur yang rusak. Kode lama tetap bisa menerima/menolak pembelian lewat `increase_stock`/`decrease_stock` (admin), dan bug F-05 masih ada sampai kode baru live.

## Checklist uji setelah deploy

- [ ] Admin → buat pembelian (Pending) → **Terima**. Stok bertambah sesuai qty, harga beli di Harga Produk ikut berubah.
- [ ] Buka lagi pembelian yang sama → tombol **Terima** nonaktif.
- [ ] **Tolak** pembelian Completed → muncul peringatan pengurangan stok → stok kembali, status Decline.
- [ ] Hapus pelanggan yang punya penjualan → pesan "tidak bisa dihapus… ubah status menjadi nonaktif". Data tetap ada.
- [ ] Hapus pelanggan/supplier baru yang belum punya transaksi → berhasil.
- [ ] Staff → simpan penjualan → kembali ke `/dashboard/staff/transaksi/penjualan`.
- [ ] Admin → set harga jual produk Rp150.000.000 → tersimpan.

## Pengujian yang sudah dilakukan

- `npx tsc --noEmit` lulus. ESLint: 0 error (4 warning lama di `PenjualanForm.tsx`, bukan dari perubahan ini).
- Migrasi diuji di PostgreSQL 15 (Docker, stub skema `auth`) setelah skema dasar + migrasi sebelumnya, dengan data contoh. Hasil:
  - Migrasi sukses dan aman dijalankan ulang. FK `RESTRICT`/`CASCADE` sesuai rencana; tidak ada kolom uang < 14 digit.
  - `receive_pembelian`: staff ditolak; admin sukses (stok 10→15, harga beli 800→850); terima ulang ditolak dan stok tetap 15.
  - `decline_pembelian`: Completed → stok 15→10; tolak ulang = no-op; stok sudah terpakai → gagal dan rollback utuh.
  - Hapus pelanggan/supplier/produk yang dipakai transaksi → `23503`; yang tidak dipakai → berhasil; hapus penjualan tetap menghapus detailnya.
  - Harga Rp150.000.000 tersimpan.
- **Belum diuji**: alur di browser dan di Supabase production.

## Rollback

- **Kode**: revert commit. Kode lama tetap berfungsi dengan database yang sudah dimigrasi.
- **Database**: RPC baru boleh dibiarkan. Presisi kolom sebaiknya **tidak** diturunkan kembali (bisa gagal jika sudah ada nilai besar). Mengembalikan FK ke CASCADE **tidak disarankan** karena membuka kembali risiko kehilangan histori.

## Pekerjaan lanjutan (belum termasuk)

F-04 sisa (`createPembelian`, `addPiutangPayment`, `updatePenjualan`, `deletePenjualan`, cancel belum atomik), F-07 (cabut UPDATE langsung staff), F-08/F-09 (PDF berbasis ID dari DB), F-13 (nomor dokumen dibuat saat form dibuka), F-16 (zona waktu), F-18 (konsistensi angka laporan), F-20/F-22 (race pembayaran & cancel).
