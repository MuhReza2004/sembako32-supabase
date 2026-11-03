# 2026-09-30 — Sisa Temuan: PDF, Nomor Dokumen, Refund, Batal DO, Laporan, Zona Waktu (A3, A4, B, C)

Lanjutan dari [2026-09-30-atomic-transactions.md](2026-09-30-atomic-transactions.md). Referensi temuan: [docs/FINDINGS.md](../FINDINGS.md).

Keputusan bisnis yang dipakai (dari pemilik, 2026-09-30):
- **A3 / F-21:** membatalkan Delivery Order = **membatalkan penjualannya**.
- **A4:** membatalkan penjualan yang sudah dibayar **dicatat sebagai refund**.

## Ringkasan

| ID | Masalah | Perbaikan |
|---|---|---|
| F-08 | Isi PDF invoice/kwitansi/DO/BAST diambil dari data kiriman browser → dokumen bisa dipalsukan. | Route PDF hanya menerima **ID** dan memuat data dari DB (cek admin/pemilik). Watermark LUNAS/BATAL ditentukan server. |
| F-09 | PDF gabungan meneruskan cookie/token ke URL dari header Host. | Render dipanggil langsung, tanpa HTTP internal. |
| F-13 | Nomor invoice/NPB/DO/TT dibuat saat form dibuka → nomor loncat. | Nomor dibuat **saat simpan** di dalam `create_penjualan`; generator tidak bisa dipanggil dari browser. |
| F-14 | Jalur edit penjualan (`tambah?id=`) rusak dan bisa menghapus semua item. | Jalur edit dan fungsi `updatePenjualan`/`deletePenjualan` dihapus. Koreksi = batal lalu buat ulang. |
| F-15 | Dashboard admin hanya auto-refresh untuk tabel penjualan. | Semua listener didaftarkan sebelum `subscribe()`. |
| F-16 | Tanggal "hari ini" memakai UTC → 00:00–07:00 WIB tercatat kemarin. | `todayWIB()` / `toDateWIB()` dipakai di semua tempat. |
| F-18 | Angka dashboard ≠ laporan ≠ piutang. | Satu definisi (lihat bawah) di RPC, service, laporan pembelian, dan dialog. |
| F-21 (A3) | Batal DO tidak membatalkan penjualan/stok. | Tombol Batal di DO memanggil `cancel_penjualan` dengan konfirmasi. |
| F-24 | `next.config.ts` mengekspor dua config. | Satu ekspor. `npm run build` lulus. |
| F-25 | Kode supplier rusak setelah SUP-999. | Sequence + RPC `generate_supplier_code()`. |
| F-31 (baru) | Penjualan "Lunas" tersimpan dengan `total_dibayar = 0` → tampil Belum Lunas di Piutang dan bisa ditagih lagi. | Data lama dikoreksi; penjualan Lunas baru langsung `total_dibayar = total_akhir`. |
| F-32 (baru) | `LPAD` memotong angka: invoice ke-10000 → `…/1000`, supplier ke-1000 → `SUP-100` → bentrok. | Fungsi `pad_number()`; semua generator nomor diperbaiki. |
| F-33 (baru) | Staff bisa memanggil fungsi total omzet/piutang seluruh toko. | Khusus admin. |
| F-34 (A4) | Refund tidak tercatat saat penjualan yang sudah dibayar dibatalkan. | `riwayat_pembayaran.tipe = 'refund'` dicatat otomatis oleh `cancel_penjualan`. |

**Definisi angka (F-18):**
- **Omzet** = Σ `COALESCE(total_akhir, total)` penjualan ≠ Batal.
- **Pengeluaran** = Σ total pembelian ≠ Decline.
- **Piutang** = Σ (tagihan − dibayar) > 0 untuk penjualan ≠ Batal.
- Semua difilter berdasarkan **tanggal transaksi** (WIB).

## Perubahan perilaku yang terlihat pengguna

**Form penjualan**
- Tidak lagi menampilkan nomor invoice/NPB/DO/TT atau tombol "Generate". Nomor dibuat otomatis saat disimpan dan selalu berurutan; lihat nomornya di daftar/detail penjualan.
- Tanggal default memakai WIB.

**Pembatalan**
- Konfirmasi batal penjualan menyebutkan bahwa pembayaran akan dicatat sebagai refund.
- Detail penjualan kini punya bagian **Riwayat Pembayaran** dengan label *Pembayaran* / *Refund*.
- **Delivery Order**: tombol **Batal** kini membatalkan penjualan (stok kembali, refund bila ada), dengan konfirmasi.

**Piutang**
- Penjualan yang dibuat dengan status Lunas **tidak lagi muncul sebagai Belum Lunas**. Setelah migrasi, jumlah piutang di dashboard/halaman piutang bisa **turun**; itu koreksi, bukan kehilangan data.
- "Total Tagihan" di detail piutang dan "Total Akhir" di detail penjualan kini sudah termasuk diskon & pajak (sebelumnya menampilkan subtotal).

**Laporan & dashboard**
- Angka dashboard (omzet, pengeluaran, piutang, jumlah transaksi, transaksi terbaru) kini sama dengan halaman laporan. Angkanya bisa **berbeda dari sebelumnya**: dulu omzet belum termasuk diskon/pajak dan difilter berdasarkan waktu input, bukan tanggal transaksi.
- Laporan pembelian: "Total Pembelian" tidak lagi menjumlah pembelian yang ditolak (Decline).

**PDF**
- Invoice penjualan yang dibatalkan kini diberi watermark **BATAL**.
- Watermark **LUNAS** muncul berdasarkan data pembayaran di database, bukan pilihan di browser.

## File yang berubah

**Database** — `sql/migrations/20260930d_remaining_findings.sql` (baru, idempoten, `BEGIN`/`COMMIT`):
1. Koreksi `total_dibayar` penjualan Lunas.
2. Kolom `riwayat_pembayaran.tipe` + CHECK.
3. `cancel_penjualan` mencatat refund.
4. `create_penjualan` membuat nomor di server; Lunas ⇒ dibayar penuh.
5. `sum_penjualan_total`, `sum_pembelian_total`, `piutang_summary` khusus admin + definisi baru.
6. `supplier_kode_seq` + `generate_supplier_code()`.
7. `pad_number()` + keempat `generate_*_number` diperbaiki; EXECUTE dicabut dari `authenticated`.

**PDF (commit terpisah `fix(pdf)`)**
- `lib/pdf/{invoice,receipt,delivery-order,bast}.ts`: kode render dipindah apa adanya dari route.
- `lib/pdf/penjualan-data.ts`: loader + cek kepemilikan.
- `lib/pdf/route-helpers.ts`.
- Kelima route `app/api/generate-{invoice,receipt,delivery-order,bast,documents}` ditulis ulang.
- Pemanggil di `DialogDetailPenjualan`, `DialogDetailPiutang`, dan halaman Delivery Order mengirim ID.
- `lib/pdf-test.ts` dihapus.

**Aplikasi**
- `components/penjualan/PenjualanForm.tsx`: tanpa penomoran, tanpa mode edit.
- `app/dashboard/admin/transaksi/penjualan/tambah/page.tsx`: tanpa `?id=`.
- `app/services/penjualan.service.ts`: dihapus `getAllPenjualan`, `getPiutang`, `updatePenjualan`, `updatePenjualanStatus`, `deletePenjualan`, generator nomor; `todayWIB`; daftar admin memuat `total_dibayar`.
- `components/penjualan/DialogDetailPenjualan.tsx`: riwayat pembayaran/refund; Total Akhir = `total_akhir`.
- `components/Piutang/DialogDetailPiutang.tsx`: perbaikan aturan Hooks; tagihan = `total_akhir`.
- `app/dashboard/admin/transaksi/delivery-order/page.tsx`: Batal = batal penjualan; tanggal WIB.
- Halaman penjualan admin & staff: pesan konfirmasi refund.
- `app/services/dashboard.service.ts`, `app/dashboard/admin/page.tsx` (realtime), `app/dashboard/admin/laporan/pembelian/page.tsx`.
- `app/services/supplier.service.ts` (RPC kode).
- `helper/format.ts` (`toDateWIB`, `todayWIB`) + pemakainya.
- `app/types/penjualan.ts` (`RiwayatPembayaran.tipe`).
- `next.config.ts`.

**Dokumentasi**: `docs/FINDINGS.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`.

## Langkah deploy

1. Pastikan migrasi `20260930`, `20260930b`, `20260930c` sudah ada di production (sudah, per verifikasi sebelumnya).
2. **Catat angka piutang saat ini** (untuk pembanding):
   ```sql
   SELECT count(*) AS lunas_tapi_dibayar_kurang
   FROM penjualan
   WHERE status = 'Lunas' AND COALESCE(total_dibayar, 0) < COALESCE(total_akhir, total);
   ```
   Baris-baris ini yang akan dikoreksi.
3. Jalankan `sql/migrations/20260930d_remaining_findings.sql` di SQL Editor production.
4. Verifikasi:
   ```sql
   -- harus 0
   SELECT count(*) FROM penjualan
   WHERE status = 'Lunas' AND COALESCE(total_dibayar, 0) < COALESCE(total_akhir, total);

   -- harus ada: generate_supplier_code, pad_number
   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('generate_supplier_code', 'pad_number');

   -- kolom tipe ada
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'riwayat_pembayaran' AND column_name = 'tipe';
   ```
5. Push `fix/remaining-findings`, buat PR ke `main`, merge, dan tunggu deploy Vercel. PR ini juga membawa commit `fix/atomic-transactions` yang belum di-merge.

Jeda antara migrasi dan deploy **aman**:
- Kode lama masih memanggil generator nomor saat form dibuka. Sekarang panggilan itu ditolak dan form menampilkan nomor sementara `INV/ERR/…`, **tetapi nomor asli tetap dibuat server saat disimpan**.
- Pembatalan lewat kode lama tetap berjalan, hanya belum mencatat refund.

## Checklist uji setelah deploy

- [ ] Staff & admin → buat penjualan → tidak ada kolom nomor di form; setelah simpan, nomor invoice muncul di daftar dan berurutan.
- [ ] Buat penjualan **Lunas** → di halaman Piutang berstatus Lunas (bukan Belum Lunas).
- [ ] Batalkan penjualan Lunas → buka detail → Riwayat Pembayaran menampilkan **Refund**.
- [ ] Delivery Order → Batal → konfirmasi → penjualan ikut Batal, stok kembali.
- [ ] Detail penjualan → Cetak Invoice, DO, Tanda Terima, Semua Dokumen → PDF muncul dengan data yang benar; invoice penjualan Batal bertanda BATAL.
- [ ] Piutang → Cetak Lunas → PDF "INVOICE PEMBAYARAN PIUTANG".
- [ ] Delivery Order → Cetak DO & BAST.
- [ ] Dashboard admin → angka omzet periode = angka Laporan Penjualan periode yang sama.
- [ ] Tambah supplier → kode `SUP-xxx` berikutnya.
- [ ] Buka `/dashboard/admin/transaksi/penjualan/tambah?id=…` → tetap form tambah biasa (mode edit sudah tidak ada).

## Pengujian yang sudah dilakukan

- `npx tsc --noEmit` lulus.
- ESLint 0 error pada file yang diubah (termasuk 2 error lama di laporan pembelian dan 1 pelanggaran aturan Hooks yang ikut diperbaiki).
- **`npm run build` lulus** (validasi `next.config.ts` dan semua route).
- PostgreSQL 15 (Docker, stub skema `auth`), setelah skema dasar + migrasi `20260930`, `b`, `c` + data lama:
  - Migrasi `d` sukses dan aman diulang. Penjualan Lunas dengan dibayar 0 → dikoreksi ke tagihan; Belum Lunas tidak tersentuh.
  - `create_penjualan` staff: nomor dari client (`INV/PALSU/1`) diabaikan; Lunas ⇒ dibayar = tagihan; TT dibuat; Diantar membuat DO.
  - `cancel_penjualan`: penjualan Lunas → refund 2.220 tercatat, `total_dibayar = 0`; penjualan belum dibayar → tanpa refund; staff bisa membaca refund miliknya.
  - Fungsi dashboard: staff ditolak; admin mendapat omzet berbasis `total_akhir` tanpa Batal, dengan filter tanggal WIB.
  - Kode supplier: SUP-999 → **SUP-1000 → SUP-1001** (sebelum perbaikan `LPAD` keduanya menjadi `SUP-100`).
  - Nomor invoice ke-9999/10000/10001 → `…/9999`, `…/10000`, `…/10001`.
  - `generate_invoice_number` langsung dari `authenticated` → ditolak, tetapi pembuatan penjualan staff tetap berhasil.
- **Belum diuji**: alur di browser, render PDF sungguhan (butuh Chrome/Chromium), dan Supabase production.

## Rollback

- **Kode**: revert commit. Kode lama tetap berjalan dengan database baru; nomor tetap dibuat server.
- **Database**: fungsi & kolom baru boleh dibiarkan. Koreksi `total_dibayar` (F-31) sebaiknya **tidak** dikembalikan. Jika perlu mengizinkan lagi pemanggilan generator dari browser:
  `GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;` (dan tiga fungsi lainnya).

## Yang masih terbuka

- **F-30**: audit penjualan dengan nomor `ERR` (query di dokumen critical-security).
- **Kebersihan**:
  - F-17: search `.or()`.
  - F-23: rate limit in-memory.
  - F-26: fallback sidebar.
  - F-27: `produk.stok` usang.
  - F-28: sisa query tanpa pagination.
  - F-29: dokumen lama di root; halaman placeholder `/Distributor/Pengiriman`.
  - Tidak ada test otomatis.
  - Belum ada baseline skema dari production.
- **Fitur**: edit penjualan yang benar (RPC `update_penjualan`) bila memang dibutuhkan.
