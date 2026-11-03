# 2026-09-30 — Transaksi Atomik & Pembatasan Tulis Staff (F-04, F-07, F-20, F-22)

Lanjutan dari [2026-09-30-fix-high-priority-data.md](2026-09-30-fix-high-priority-data.md). Referensi temuan: [docs/FINDINGS.md](../FINDINGS.md).

## Ringkasan

| ID | Masalah | Perbaikan |
|---|---|---|
| F-04 | Membuat pembelian, membayar piutang, dan membatalkan penjualan dijalankan sebagai beberapa request terpisah. Gagal di tengah → data setengah jadi. | Masing-masing jadi satu RPC dalam satu transaksi database: `create_pembelian`, `add_penjualan_payment`, `cancel_penjualan`. |
| F-07 | Staff bisa mengubah langsung penjualan miliknya lewat API Supabase (mis. set `Lunas`, ubah total, tambah pembayaran). | Akses tulis langsung staff dicabut dari 4 tabel transaksi penjualan. Staff hanya bisa membaca miliknya; menulis hanya lewat RPC. |
| F-20 | Pembayaran piutang: dua admin membayar bersamaan bisa saling timpa; validasi sisa hanya di browser; penjualan Batal masih bisa dibayar. | RPC `add_penjualan_payment` mengunci baris, memvalidasi ulang di server, dan menolak penjualan Batal/sudah lunas. |
| F-22 | Pembatalan penjualan bisa mengembalikan stok dua kali bila diklik bersamaan atau diulang setelah gagal. | RPC `cancel_penjualan` mengunci baris; penjualan yang sudah Batal tidak diproses lagi. |

## Perubahan perilaku yang terlihat pengguna

- **Pembayaran piutang**: pesan error sekarang datang dari server bila jumlah 0, melebihi sisa, penjualan sudah lunas, atau penjualan sudah dibatalkan.
- **Pembatalan penjualan**: tampilannya sama. Klik ganda atau percobaan ulang tidak lagi menambah stok berlebih.
- **Pembelian**
  - Jika produk yang dipilih bukan milik supplier yang dipilih (mis. supplier diganti setelah item ditambahkan), penyimpanan ditolak dengan pesan "Produk tidak ditemukan untuk supplier ini" dan tidak ada yang tersimpan.
  - Subtotal dan total dihitung ulang di server dari qty × harga.
- **Staff**: tidak ada perubahan di UI. Alur staff (buat & batal penjualan) memang sudah lewat RPC.

## File yang berubah

**Database**
- `sql/migrations/20260930c_atomic_transactions.sql` (baru):
  - RPC `cancel_penjualan`, `add_penjualan_payment`, `create_pembelian`.
  - RLS pada `penjualan`, `penjualan_detail`, `riwayat_pembayaran`, `delivery_orders`: semua policy non-SELECT dihapus (nama policy dibaca dari katalog, dicetak sebagai NOTICE), lalu dibuat ulang satu policy tulis khusus admin. Policy SELECT staff tidak disentuh.
  - Idempoten, `BEGIN`/`COMMIT`.

**Aplikasi**
- `app/services/penjualan.service.ts`: `addPiutangPayment` → `rpc("add_penjualan_payment")`; `cancelPenjualan` → `rpc("cancel_penjualan")`.
- `app/services/pembelian.service.ts`: `createPembelian` → `rpc("create_pembelian")`; helper `increaseStock` yang tidak terpakai dihapus.
- **Dihapus**: `app/api/penjualan/cancel/route.ts`. Rute ini memakai service role; pengecekan pemilik sekarang dilakukan di database.

**Dokumentasi**: `docs/FINDINGS.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`.

## Langkah deploy

Urutan penting: **migrasi dulu, baru deploy kode.**

- Kode baru memanggil RPC yang dibuat migrasi ini.
- Sebaliknya, setelah migrasi jalan, kode lama tetap berfungsi. Satu-satunya jalur yang memakai penulisan langsung oleh staff adalah rute `/api/penjualan/cancel`, dan rute itu memakai service role sehingga tidak terkena RLS.

1. Pastikan migrasi `20260930_fix_critical_security.sql` dan `20260930b_fix_high_priority_data.sql` sudah dijalankan di production (`dwdgixftljajyafeljpc`).
2. Jalankan `sql/migrations/20260930c_atomic_transactions.sql` di SQL Editor production. Catat NOTICE "Policy dihapus: …". Itu daftar policy lama yang diganti.
3. Verifikasi:
   ```sql
   -- Staff hanya punya SELECT; admin punya ALL
   SELECT tablename, cmd, policyname FROM pg_policies
   WHERE tablename IN ('penjualan','penjualan_detail','riwayat_pembayaran','delivery_orders')
   ORDER BY 1, 2;

   -- Harus berisi cancel_penjualan, add_penjualan_payment, create_pembelian
   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('cancel_penjualan','add_penjualan_payment','create_pembelian');
   ```
   Jika hasil query policy memperlihatkan tabel tanpa policy SELECT untuk staff (hanya `Admins manage …`), staff tidak akan bisa melihat penjualannya. Kirimkan hasilnya sebelum deploy.
4. Merge & deploy kode.

## Checklist uji setelah deploy

- [ ] Staff → buat penjualan → tampil di daftar penjualan staff.
- [ ] Staff → batalkan penjualan miliknya → status Batal, stok kembali, DO (jika ada) Batal.
- [ ] Admin → Piutang → bayar sebagian → status tetap Belum Lunas, sisa berkurang.
- [ ] Admin → bayar sisa → status Lunas.
- [ ] Admin → coba bayar melebihi sisa → ditolak.
- [ ] Admin → Pembelian → tambah pembelian (Tunai & Transfer) → tersimpan dengan total benar.
- [ ] Admin → Delivery Order → ubah status Draft → Dikirim → Diterima (masih lewat update langsung; admin tetap diizinkan).
- [ ] Laporan penjualan, piutang, dan PDF invoice tetap tampil.

## Pengujian yang sudah dilakukan

- `npx tsc --noEmit` lulus. ESLint 0 error pada service yang diubah.
- PostgreSQL 15 (Docker, stub skema `auth`), setelah skema dasar + dua migrasi sebelumnya:
  - Migrasi sukses dan aman dijalankan ulang. Policy akhir: `Admins manage <tabel>` (ALL) + `Staff read own …` (SELECT).
  - **F-07**: staff `UPDATE penjualan SET status='Lunas'` → 0 baris; `UPDATE delivery_orders` → 0 baris; `INSERT` langsung ke `riwayat_pembayaran`/`penjualan` → ditolak RLS; staff tetap bisa membaca penjualannya; `create_penjualan` staff tetap berhasil.
  - **F-20**: staff ditolak; jumlah 0 dan jumlah > sisa ditolak; 1000 → Belum Lunas, 2000 → Lunas; bayar setelah lunas ditolak; bayar penjualan Batal ditolak.
  - **F-22**: staff lain ditolak; pemilik membatalkan → stok 7→10, DO Batal; batal kedua → stok tetap 10.
  - **F-04**: staff ditolak membuat pembelian; produk supplier lain → seluruh pembelian dibatalkan; Transfer tanpa data rekening ditolak; total dari client diabaikan (4 × 850,5 = 3.402); status Completed langsung menambah stok dan harga beli.
- **Belum diuji**: alur di browser dan di Supabase production.

## Rollback

- **Kode**: revert commit. Catatan: kode lama memanggil `/api/penjualan/cancel` yang ikut kembali dengan revert, dan rute itu tetap berfungsi dengan database baru.
- **Database**: RPC baru boleh dibiarkan. Mengembalikan policy tulis staff **tidak disarankan** karena membuka kembali F-07. Jika terpaksa, lihat definisi lama di `supabase-schema.sql` (policy "Staff insert/update own …").

## Pekerjaan lanjutan (belum termasuk)

- F-14: `updatePenjualan`/`deletePenjualan` (admin, tidak dipakai UI) masih multi-langkah.
- F-21: pembatalan DO berdiri sendiri. Butuh keputusan bisnis: kirim ulang atau batal penjualan.
- Pembatalan penjualan yang sudah dibayar belum mencatat pengembalian dana.
- F-08/F-09: PDF dari data body request.
- F-13: nomor dokumen dibuat saat form dibuka.
- F-16: zona waktu UTC di client.
- F-18: konsistensi angka laporan.
