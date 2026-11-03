# Status Pekerjaan — Sembako32

> Dokumen serah terima antar sesi. Perbarui setiap kali status berubah.
> Terakhir diperbarui: **2026-09-30**.

Acuan lain: [CLAUDE.md](../CLAUDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [FEATURE-GUIDE.md](FEATURE-GUIDE.md) · [FINDINGS.md](FINDINGS.md) · [changes/](changes/)

## 1. Ringkasan

Audit codebase menghasilkan 34 temuan (F-01 … F-34). Semua temuan **kritis, tinggi, dan sedang sudah diperbaiki di kode**, dalam 4 paket perubahan. Yang tersisa: uji di browser, merge PR terakhir, audit nomor `ERR`, dan kebersihan (kelompok D).

## 2. Lingkungan

| Hal | Nilai |
|---|---|
| Supabase production | project ref `dwdgixftljajyafeljpc` (`.env.prod`) |
| Supabase development | project ref `thbdyzairfkwkruslivl` (`.env.local`) |
| Deploy | Vercel, otomatis dari `main` |
| Repo | GitHub `MuhReza2004/…` (PR #1, #2 sudah di-merge) |
| Signup publik Supabase production | **Dimatikan** oleh pemilik (2026-09-30) |

## 3. Status paket perubahan

| # | Paket | Branch / commit | Migrasi DB (production) | Kode di `main` / live |
|---|---|---|---|---|
| 1 | Keamanan kritis F-01, F-02, F-03, F-10 | `fix/critical-security` `8ef0f8a` | ✅ `20260930_fix_critical_security.sql` | ✅ PR #1 |
| 2 | Prioritas tinggi F-05, F-06, F-11, F-12, F-19 | `fix/high-priority-data` `c119cdf` | ✅ `20260930b_fix_high_priority_data.sql` | ✅ PR #2 |
| 3 | Transaksi atomik F-04, F-07, F-20, F-22 | `fix/atomic-transactions` `e58de96` | ✅ `20260930c_atomic_transactions.sql` (policy terverifikasi) | ⏳ **belum di-merge** |
| 4 | Sisa temuan A3, A4, F-08…F-25, F-31…F-34 | `fix/remaining-findings` `5c7d9b8` + `9711366` (di atas paket 3) | ✅ `20260930d_remaining_findings.sql` (dijalankan pemilik) | ⏳ **belum di-merge** (branch sudah di-push) |

Per 2026-09-30, `origin/main` = `2544e3c`, jadi paket 3 & 4 **belum live**. Satu PR `fix/remaining-findings` → `main` sudah membawa keduanya.

**Kondisi saat ini aman:** kode lama di `main` tetap berjalan dengan database yang sudah dimigrasi.
- Form lama akan menampilkan nomor sementara `INV/ERR/…` karena generator nomor sudah dicabut dari browser, tetapi nomor asli tetap dibuat server saat disimpan.
- Pembatalan lewat kode lama belum mencatat refund.

Detail tiap paket (isi, langkah deploy, checklist uji, rollback) ada di `docs/changes/2026-09-30-*.md`.

## 4. Langkah berikutnya (urut)

1. **Merge PR `fix/remaining-findings` → `main`** dan tunggu Vercel **Ready**.
2. **Uji manual di production** sesuai checklist di [changes/2026-09-30-remaining-findings.md](changes/2026-09-30-remaining-findings.md#checklist-uji-setelah-deploy):
   - A. staff buat penjualan: form tanpa nomor, nomor berurutan, redirect ke halaman staff;
   - B. penjualan Lunas tampil Lunas di Piutang;
   - C. batal penjualan Lunas: refund tercatat, stok kembali;
   - D. batal DO: penjualan ikut batal;
   - E. **PDF** invoice / DO / tanda terima / semua dokumen / cetak lunas / BAST. **Belum pernah diuji**; paling berisiko;
   - F. angka dashboard = laporan penjualan;
   - G. tambah supplier → kode berikutnya.

   Bila gagal: minta pesan error, Console (F12), dan Response request `generate-*`. Rollback cepat: Vercel → Deployments → *Promote to Production* versi sebelumnya (database tidak perlu diubah).
3. **Audit nomor `ERR` (F-30).** Hasil query ini belum pernah diterima:
   ```sql
   SELECT id, tanggal, no_invoice, no_npb, no_do, no_tanda_terima FROM penjualan
   WHERE no_invoice LIKE '%ERR%' OR no_npb LIKE '%ERR%' OR no_do LIKE '%ERR%' OR no_tanda_terima LIKE '%ERR%'
   ORDER BY tanggal;
   ```
   Bila ada baris: buat migrasi untuk memberi nomor yang benar (pertimbangkan invoice yang sudah dicetak ke pelanggan).
4. **Audit akun**: `SELECT id, email, role, created_at FROM users ORDER BY created_at DESC;` Hapus akun asing.
5. **Kelompok D (kebersihan)**:
   - F-17: escape input search di `.or()`;
   - F-23: rate limit in-memory;
   - F-26: fallback menu admin di Sidebar;
   - F-27: `produk.stok`, tabel `inventory` / `stock_adjustments` usang;
   - F-28: sisa query tanpa pagination (`getAllPembelian`, list master `select *`, `count: "planned"`);
   - F-29: dokumen lama di root, halaman placeholder `app/Distributor/Pengiriman`, `app/hooks/usePembelian.ts`.
6. **Jangka panjang**:
   - test otomatis (belum ada sama sekali);
   - baseline skema dari production (`supabase db dump`);
   - route laporan (`generate-sales-report` / `generate-purchase-report`) belum dipindah ke pola `lib/pdf/`;
   - fitur edit penjualan yang benar (RPC `update_penjualan`) hanya bila dibutuhkan.

## 5. Keputusan bisnis yang sudah diambil

| Topik | Keputusan (2026-09-30) |
|---|---|
| Registrasi | Tidak ada signup publik; akun dibuat admin di Supabase Dashboard (otomatis `staff`) |
| Batal Delivery Order (F-21 / A3) | = membatalkan penjualannya (stok kembali) |
| Batal penjualan yang sudah dibayar (A4) | Dicatat sebagai **refund** di `riwayat_pembayaran` (`tipe = 'refund'`), `total_dibayar` → 0 |
| Edit penjualan | Tidak didukung; koreksi = batalkan lalu buat ulang |
| Nomor dokumen | Dibuat server saat simpan, sequence global, tanggal WIB |
| Definisi angka | Omzet = Σ `total_akhir` ≠ Batal · Pengeluaran = Σ pembelian ≠ Decline · Piutang = Σ sisa > 0 · filter kolom `tanggal` |

## 6. Cara kerja yang disepakati

- Bahasa: Indonesia.
- Setiap paket: branch `fix/<nama>`, satu atau beberapa commit, dokumen `docs/changes/YYYY-MM-DD-<nama>.md` (ringkasan, perubahan perilaku, file, langkah deploy, checklist uji, pengujian, rollback). Pemilik yang melakukan **push & merge**.
- Perubahan DB: file baru di `sql/migrations/` (idempoten, `BEGIN`/`COMMIT`), diuji dulu di Docker `postgres:15-alpine` + stub skema `auth` (lihat FEATURE-GUIDE §6), lalu **dijalankan manual oleh pemilik** di production. Urutan: migrasi → verifikasi query → merge/deploy.
- Verifikasi kode: `npx tsc --noEmit`, ESLint pada file yang diubah, `npm run build` bila menyentuh config/route.
