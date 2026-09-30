# Temuan Audit Codebase — Sembako32

> Hasil analisis statis pada commit `9b98b3e` (2026-09-30). `npx tsc --noEmit` lulus.
> Status tiap temuan: **Open** kecuali ditandai lain (✅ = diperbaiki). Perbaikan 2026-09-30 tercatat di `docs/changes/2026-09-30-*.md`.
> Migrasi DB: `sql/migrations/20260930_*.sql` s.d. `20260930d_*.sql` (dijalankan manual di Supabase, berurutan).
> Tingkat: 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · ⚪ Rendah/kebersihan.

## Ringkasan prioritas

| ID | Tingkat | Area | Judul singkat |
|---|---|---|---|
| F-01 | ✅ | Keamanan | Role dibaca dari `user_metadata` (bisa diubah user sendiri) |
| F-02 | ✅* | Keamanan | Registrasi publik → siapa saja jadi `staff` (*perlu setting Supabase) |
| F-03 | ✅* | Keamanan/Stok | RPC `increase_stock`/`decrease_stock` terbuka untuk semua user login (*perlu migrasi) |
| F-04 | ✅ | Integritas | Transaksi multi-langkah tidak atomik |
| F-05 | ✅ | Stok | Pembelian `Completed` bisa "diterima" ulang → stok ganda |
| F-06 | ✅ | Data | `ON DELETE CASCADE` menghapus histori transaksi |
| F-07 | ✅ | Integritas | Staff bisa ubah status/total/pembayaran penjualannya sendiri langsung via API |
| F-08 | ✅ | Integritas | PDF invoice/kwitansi/DO merender data dari body request |
| F-09 | ✅ | Keamanan | `generate-documents` meneruskan cookie/token ke origin dari header Host |
| F-10 | ✅ | Keamanan | Middleware memakai `getSession()` (tidak diverifikasi) |
| F-11 | ✅ | Bug DB | `setval` sequence NPB & DO memakai bagian nomor yang salah |
| F-12 | ✅ | Bug | Staff diarahkan ke halaman admin setelah simpan penjualan |
| F-13 | ✅ | Bug | Nomor dokumen di-generate saat form dibuka → nomor lompat; fallback `INV/ERR/...` |
| F-14 | ✅ | Bug laten | Jalur edit penjualan (`tambah?id=`) rusak dan destruktif |
| F-15 | ✅ | Bug | Realtime dashboard admin hanya mendengar tabel `penjualan` |
| F-16 | ✅ | Bug | Tanggal "hari ini" pakai UTC (`toISOString`) bukan WIB |
| F-17 | ⚪ | Keamanan | Input search disisipkan mentah ke filter `.or()` PostgREST |
| F-18 | ✅ | Laporan | Angka omzet/piutang tidak konsisten (`total` vs `total_akhir`, `created_at` vs `tanggal`) |
| F-19 | ✅ | DB | Kolom uang `DECIMAL(10,2)` vs validasi aplikasi `14,2` |
| F-20 | ✅ | Piutang | Pembayaran piutang rawan race & overpay |
| F-21 | ✅ | Alur | Batal DO tidak membatalkan penjualan/stok |
| F-22 | ✅ | Alur | Cancel penjualan bisa mengembalikan stok dua kali (race) |
| F-23 | ⚪ | Infra | Rate limiter in-memory tidak efektif di serverless |
| F-24 | ✅ | Config | `next.config.ts` mengekspor dua config berbeda |
| F-25 | ✅ | Data | Generator kode supplier rusak setelah `SUP-999` & rawan race |
| F-26 | ⚪ | UI | Sidebar menampilkan menu admin saat role gagal dimuat |
| F-27 | ⚪ | Data | `produk.stok`, `inventory`, `stock_adjustments` usang/tidak sinkron |
| F-28 | ⚪ | Performa | Query tanpa filter/pagination |
| F-29 | ⚪ | Kebersihan | Error stack bocor, kode mati, dokumen lama, tanpa test |
| F-30 | ✅* | DB | Skema produksi berbeda dari `supabase-schema.sql` (*audit nomor ERR tersisa) |
| F-31 | ✅ | Data | Penjualan "Lunas" menyimpan `total_dibayar = 0` → tampil Belum Lunas di Piutang |
| F-32 | ✅ | Bug DB | `LPAD` memotong nomor ≥ 10000 (invoice) / ≥ 1000 (supplier) → nomor bentrok |
| F-33 | ✅ | Keamanan | Fungsi dashboard (`sum_*`, `piutang_summary`) bisa dipanggil staff |
| F-34 | ✅ | Alur | Refund tidak tercatat saat penjualan yang sudah dibayar dibatalkan |

---

## 🔴 Kritis

### F-01 — Role dipercaya dari `user_metadata`
- **Lokasi**: [middleware.ts:65-70](../middleware.ts#L65-L70), [app/lib/api-guard.ts](../app/lib/api-guard.ts) (`app_metadata.role ?? user_metadata.role`), [hooks/useUserRole.ts](../hooks/useUserRole.ts), [components/auth/LoginForm.tsx:38-40](../components/auth/LoginForm.tsx#L38-L40).
- **Masalah**: `user_metadata` bisa diisi user sendiri (`supabase.auth.signUp({ options: { data: { role: "admin" } } })` atau `updateUser`). Jika `app_metadata.role` belum ada, nilai itu dipakai. `LoginForm` juga tidak memanggil `/api/auth/sync-role` bila `user_metadata.role` sudah ada, sehingga `app_metadata` tidak pernah di-set.
- **Dampak**: lolos `requireAdmin` → akses `/api/generate-sales-report`, `/api/generate-purchase-report`, `/api/inventory-report` (service role, **seluruh data penjualan/pembelian**), serta halaman server `admin/transaksi/penjualan/tambah` yang membaca data dengan `supabaseAdmin`. Query client tetap tertahan RLS (karena `is_admin()` membaca tabel `users`).
- **Perbaikan**: hanya pakai `app_metadata.role` (tidak bisa diubah user) atau baca tabel `users`; hapus semua fallback `user_metadata.role`. Selalu jalankan sync-role saat login.
- **Status: ✅ Diperbaiki.** `user_metadata` dihapus dari middleware, `useUserRole`, `LoginForm`, dan `sync-role`. `api-guard` kini selalu membaca role dari tabel `users`. `LoginForm` selalu memanggil sync-role. Halaman server `admin/transaksi/penjualan/tambah` memverifikasi admin sendiri lewat `getServerUserRole()` (`lib/supabase-server.ts`).

### F-02 — Registrasi publik menghasilkan akun staff
- **Lokasi**: [app/auth/register/page.tsx](../app/auth/register/page.tsx), [components/auth/RegisterForm.tsx](../components/auth/RegisterForm.tsx), trigger `handle_new_user` di `supabase-schema.sql`.
- **Masalah**: siapa pun bisa mendaftar (via halaman atau langsung ke API Supabase dengan anon key) dan otomatis mendapat role `staff`.
- **Dampak**: staff dapat membaca seluruh `pelanggan` (data pribadi: telp, alamat, NIB), `supplier_produk` (termasuk `harga_beli`/margin), membuat penjualan, dan memanggil RPC stok (F-03). Diperparah F-01.
- **Perbaikan**: matikan "Enable email signups" di Supabase Auth dan hapus halaman register; buat user lewat dashboard Supabase / fitur admin (invite) dengan service role. Pertimbangkan role default tanpa akses (mis. `pending`).
- **Status: ✅ Kode diperbaiki**: `app/auth/register`, `RegisterForm`, dan `register()` dihapus. **⚠️ Masih wajib**: Supabase Dashboard → Authentication → Sign In / Providers → matikan *Allow new users to sign up*. Tanpa itu signup tetap bisa dilakukan langsung ke API Supabase memakai anon key. Setelahnya, audit tabel `users` untuk akun asing.

### F-03 — RPC stok bisa dipanggil siapa saja tanpa validasi
- **Lokasi**: `supabase-schema.sql` fungsi `increase_stock`, `decrease_stock` (`SECURITY DEFINER`, `GRANT ... TO authenticated`).
- **Masalah**: tidak ada cek role/kepemilikan dan tidak ada validasi `p_qty > 0`. `SECURITY DEFINER` mem-bypass RLS `supplier_produk` (yang seharusnya admin-only untuk write). `increase_stock` dengan qty negatif pun mengurangi stok tanpa batas bawah.
- **Dampak**: user login mana pun bisa mengubah stok produk apa pun lewat `supabase.rpc(...)` dari console browser.
- **Perbaikan**: pindahkan pengurangan/penambahan stok ke dalam RPC transaksi tingkat tinggi (mis. `create_penjualan(payload jsonb)`, `receive_pembelian(id)`, `cancel_penjualan(id)`) yang memvalidasi role/kepemilikan dan qty; `REVOKE EXECUTE` fungsi stok mentah dari `authenticated`.
- **Status: ✅ Diperbaiki** lewat migrasi `sql/migrations/20260930_fix_critical_security.sql`. `increase_stock`/`decrease_stock` hanya bisa dipanggil admin/service role dengan qty > 0. RPC baru `create_penjualan` bersifat atomik (dipakai admin & staff), menghitung harga dan total di server, dan mengunci baris stok (`FOR UPDATE`). EXECUTE untuk PUBLIC/anon dicabut dari semua RPC. Diuji di Postgres 15 (Docker) dengan stub skema `auth`: akses per role, rollback saat stok kurang, manipulasi harga diabaikan, nomor bentrok di-retry, dan migrasi aman dijalankan ulang.

## 🟠 Tinggi

### F-04 — Transaksi tidak atomik
- **Lokasi**: [app/services/penjualan.service.ts](../app/services/penjualan.service.ts) (`createPenjualan` L43-192, `updatePenjualan` L1030-1112, `deletePenjualan` L1115-1128, `addPiutangPayment` L954-1009), [app/services/pembelian.service.ts](../app/services/pembelian.service.ts) (`createPembelian`, `updatePembelianAndStock`, `updatePembelianStatus`), [app/api/penjualan/cancel/route.ts](../app/api/penjualan/cancel/route.ts).
- **Masalah**: tiap langkah adalah request HTTP terpisah dari browser. Contoh `createPenjualan`: header penjualan sudah tersimpan, item 1–2 sudah mengurangi stok, item 3 gagal (stok kurang) → error dilempar, **header + item 1–2 tetap ada** tanpa rollback. Tab ditutup di tengah proses juga meninggalkan data setengah jadi. `deletePenjualan` mengabaikan error delete.
- **Perbaikan**: implementasikan sebagai fungsi PL/pgSQL (satu transaksi) dan panggil sekali via `supabase.rpc`. Sekaligus hitung ulang `subtotal/total/pajak/total_akhir` di server dari harga `supplier_produk`.
- **Status: hampir selesai.** Sudah atomik lewat RPC: `create_penjualan`, `cancel_penjualan`, `add_penjualan_payment`, `create_pembelian`, `receive_pembelian`, `decline_pembelian`. **Sisa:** `updatePenjualan` & `deletePenjualan` (khusus admin, tidak dipanggil UI mana pun — lihat F-14). Jangan aktifkan sebelum dijadikan RPC.
- **Status: ✅ Selesai** (lanjutan): `updatePenjualan`/`deletePenjualan`/`updatePenjualanStatus` yang multi-langkah dan tidak dipakai UI **dihapus** bersama jalur edit (F-14). Semua penulisan transaksi kini lewat RPC atomik.

### F-05 — Stok bertambah ganda pada pembelian
- **Lokasi**: [components/pembelian/pembelianTabel.tsx:160-170](../components/pembelian/pembelianTabel.tsx#L160-L170) (tombol Edit hanya disable untuk `Decline`), [components/pembelian/DialogEditPembelian.tsx:100-105](../components/pembelian/DialogEditPembelian.tsx#L100-L105), `updatePembelianAndStock`.
- **Masalah**: pembelian yang sudah `Completed` masih bisa dibuka dan disubmit lagi; service tidak memeriksa status sebelumnya → `increase_stock` dijalankan ulang.
- **Perbaikan**: di service, update bersyarat `.eq("status","Pending")` dan hentikan jika 0 baris; di UI, disable tombol untuk `Completed`. Idealnya RPC atomik (F-04).
- **Status: ✅ Diperbaiki** lewat RPC atomik `receive_pembelian` (hanya admin, menolak status selain Pending, `FOR UPDATE`) dan `decline_pembelian` (Completed → stok dikurangi kembali, gagal utuh bila stok sudah terpakai; Decline ulang = no-op) di `sql/migrations/20260930b_fix_high_priority_data.sql`. Tombol **Terima** di `DialogEditPembelian` nonaktif untuk non-Pending; pesan konfirmasi Tolak menjelaskan pengurangan stok.

### F-06 — Cascade delete menghapus histori
- **Lokasi**: `supabase-schema.sql` — `penjualan.pelanggan_id`, `pembelian.supplier_id`, `supplier_produk.*`, `penjualan_detail.supplier_produk_id`, `pembelian_detail.supplier_produk_id` semuanya `ON DELETE CASCADE`.
- **Masalah**: menghapus pelanggan di UI menghapus **semua penjualan, pembayaran, dan DO** pelanggan itu. Menghapus supplier/produk/harga produk menghapus detail penjualan & pembelian historis (total di header tidak lagi cocok, stok tidak dikembalikan). `TODO-supplier-delete-fix.md` bahkan mengandalkan perilaku ini.
- **Perbaikan**: ganti ke `ON DELETE RESTRICT` untuk FK transaksi; gunakan soft delete (`status = 'nonaktif'` / `status=false`) untuk master data; beri pesan jelas di UI saat data masih dipakai.
- **Status: ✅ Diperbaiki** di `sql/migrations/20260930b_fix_high_priority_data.sql`: `penjualan.pelanggan_id`, `pembelian.supplier_id`, `penjualan_detail.supplier_produk_id`, `pembelian_detail.supplier_produk_id` → RESTRICT. `supplier_produk` → supplier/produk tetap CASCADE (harga yang belum dipakai ikut terhapus). Service `delete*` mengubah error `23503` menjadi pesan yang menyarankan menonaktifkan data.

### F-07 — Staff bisa memanipulasi penjualannya sendiri
- **Lokasi**: policy `"Staff update own penjualan"`, `"Staff insert/update own riwayat_pembayaran"`, `"Staff update own penjualan_detail"`.
- **Masalah**: RLS mengizinkan staff meng-update kolom apa pun pada penjualan miliknya (`status='Lunas'`, `total_dibayar`, `total_akhir`, harga item), menambah pembayaran, dan insert penjualan dengan harga bebas — tidak ada validasi server.
- **Perbaikan**: batasi staff hanya INSERT via RPC `create_penjualan` (harga dihitung server); cabut UPDATE langsung; pembayaran/pelunasan hanya admin atau via RPC.
- **Status: ✅ Diperbaiki** di `sql/migrations/20260930c_atomic_transactions.sql`: semua policy non-SELECT pada `penjualan`, `penjualan_detail`, `riwayat_pembayaran`, `delivery_orders` dihapus dan diganti satu policy tulis khusus admin. Staff hanya bisa **membaca** miliknya; menulis hanya lewat RPC `create_penjualan` & `cancel_penjualan`. Diuji: UPDATE langsung staff = 0 baris, INSERT langsung ditolak RLS.

### F-08 — Dokumen PDF dapat dipalsukan isinya
- **Lokasi**: [app/api/generate-invoice/route.ts:930-1012](../app/api/generate-invoice/route.ts#L930-L1012), `generate-receipt`, `generate-delivery-order`, `generate-bast`, `generate-documents`.
- **Masalah**: isi dokumen (item, harga, total, nama pelanggan) diambil dari body request; untuk staff hanya dicek bahwa `no_invoice`/`no_do` miliknya. Admin tanpa cek sama sekali.
- **Dampak**: invoice/kwitansi resmi berlogo bisa dicetak dengan angka berbeda dari DB.
- **Perbaikan**: body cukup berisi `id`; route mengambil data dari DB (seperti `generate-sales-report`).
- **Status: ✅ Diperbaiki**: semua route PDF dokumen penjualan menerima **ID saja** (`penjualan_id` / `delivery_order_id`) dan memuat data dari DB lewat `lib/pdf/penjualan-data.ts` (cek: admin, atau staff pembuat). Watermark LUNAS/BATAL & nominal "pembayaran piutang" ditentukan server. Kode render dipindah ke `lib/pdf/*.ts`.

### F-11 — `setval` sequence salah bagian
- **Lokasi**: `supabase-schema.sql:371-374` dan `update-schema.sql:888-891`.
- **Masalah**: format NPB `NPB/G001/YYYY/MM/DD/NNNN` → nomor urut di bagian **6**, tapi dipakai `SPLIT_PART(...,5)` (= hari). Format DO `DO/S32/YYYY/MM/NNNN` → nomor di bagian **5**, tapi dipakai `4` (= bulan). Sequence di-reset ke nilai kecil → nomor duplikat → insert gagal 23505 (lalu retry 3× dan bisa gagal total). Juga `no_do` sebaiknya dihitung dari `delivery_orders`.
- **Perbaikan**: koreksi indeks ke 6 (NPB) dan 5 (DO) sebelum menjalankan skrip lagi.
- **Status: ✅ Diperbaiki** di `supabase-schema.sql` dan `update-schema.sql`. `update-schema.sql` ditandai **usang** (digantikan migrasi `20260930_fix_critical_security.sql` yang aman terhadap nomor `ERR`).

### F-12 — Redirect staff salah setelah simpan penjualan
- **Lokasi**: [components/penjualan/PenjualanForm.tsx:206](../components/penjualan/PenjualanForm.tsx#L206).
- **Masalah**: selalu `router.push("/dashboard/admin/transaksi/penjualan")`; untuk staff middleware mengalihkan ke `/dashboard/staff?error=not_admin`.
- **Perbaikan**: terima prop `redirectTo` (atau tentukan dari role) — staff ke `/dashboard/staff/transaksi/penjualan`.
- **Status: ✅ Diperbaiki**: prop `redirectTo` di `PenjualanForm` (default admin); halaman staff mengirim `/dashboard/staff/transaksi/penjualan`.

## 🟡 Sedang

### F-09 — Token diteruskan ke origin dari header Host
- **Lokasi**: [app/api/generate-documents/route.ts:55-68](../app/api/generate-documents/route.ts#L55-L68).
- **Masalah**: jika `NEXT_PUBLIC_BASE_URL` tidak di-set, `baseUrl = new URL(request.url).origin` lalu `Cookie` + `Authorization` dikirim ke URL itu. Header Host yang dimanipulasi bisa membocorkan token (bergantung pada proxy/hosting).
- **Perbaikan**: set `NEXT_PUBLIC_BASE_URL` wajib, atau lebih baik ekstrak fungsi `generatePdf` tiap dokumen ke `lib/` dan panggil langsung tanpa HTTP.
- **Status: ✅ Diperbaiki**: `generate-documents` memanggil fungsi render langsung (tanpa HTTP), sehingga cookie/token tidak diteruskan ke mana pun.

### F-10 — `getSession()` di middleware
- **Lokasi**: [middleware.ts:59-61](../middleware.ts#L59-L61).
- **Masalah**: `getSession()` di server tidak memverifikasi JWT ke Supabase Auth; rekomendasi Supabase adalah `getUser()`/`getClaims()`. Middleware juga memakai API cookie `get/set/remove` yang sudah deprecated di `@supabase/ssr` 0.8 (pakai `getAll/setAll`).
- **Status: ✅ Diperbaiki** (dikerjakan bersama F-01): middleware memakai `getUser()` dan `getAll/setAll`. `sync-role` masih memakai API cookie lama (fungsional).

### F-13 — Nomor dokumen terbakar & fallback berbahaya
- **Lokasi**: [components/penjualan/PenjualanForm.tsx:120-150](../components/penjualan/PenjualanForm.tsx#L120-L150), generator di `penjualan.service.ts:1169-1206`.
- **Masalah**: 3–4 `nextval` dipanggil setiap form dibuka dan setiap ganti metode pengambilan → nomor invoice lompat (masalah untuk audit/pajak). `no_tanda_terima` ikut tersimpan untuk "Ambil Langsung". Jika RPC gagal, nomor `INV/ERR/<timestamp>` diam-diam dipakai dan disimpan.
- **Perbaikan**: generate nomor di server saat insert (default kolom/di RPC `create_penjualan`); tampilkan "(otomatis)" di form; lempar error alih-alih fallback.
- **Status: ✅ Diperbaiki** di `sql/migrations/20260930d_remaining_findings.sql`: `create_penjualan` selalu membuat nomor di server saat simpan (nomor dari client diabaikan); form tidak lagi memanggil generator; `generate_*_number` dicabut dari `authenticated`; fallback `INV/ERR` di client dihapus.

### F-14 — Jalur edit penjualan rusak (laten)
- **Lokasi**: [app/dashboard/admin/transaksi/penjualan/tambah/page.tsx](../app/dashboard/admin/transaksi/penjualan/tambah/page.tsx) + `PenjualanForm` + `updatePenjualan`.
- **Masalah**: data edit di-select sebagai `penjualan_detail(*)` sedangkan form membaca `items` → item kosong. Submit akan: kembalikan stok, **hapus semua detail**, lalu `update` gagal karena payload berisi kolom asing (`penjualan_detail`, `id`, dst.). Saat ini tidak ada tombol yang membuka `?id=`, jadi belum terpicu.
- **Perbaikan**: jangan aktifkan edit sebelum dipetakan ulang dan dibuat atomik; atau hapus jalur ini.
- **Status: ✅ Diperbaiki dengan menghapus jalur edit**: mode `?id=`, prop `editingPenjualan`, dan fungsi `updatePenjualan`/`deletePenjualan` dihapus. Koreksi penjualan = batalkan lalu buat ulang. Fitur edit yang benar butuh RPC `update_penjualan` baru.

### F-15 — Realtime dashboard admin tidak lengkap
- **Lokasi**: [app/dashboard/admin/page.tsx:98-105](../app/dashboard/admin/page.tsx#L98-L105).
- **Masalah**: `.subscribe()` dipanggil di dalam `forEach` untuk channel yang sama. Pada realtime-js yang terpasang, subscribe kedua dst. tidak berefek, sehingga hanya binding pertama (`penjualan`) yang terdaftar; perubahan pembelian/produk/dll. tidak memicu refresh.
- **Perbaikan**: daftarkan semua `.on(...)` dulu, lalu `.subscribe()` sekali.
- **Status: ✅ Diperbaiki**: semua `.on()` didaftarkan lalu `.subscribe()` sekali.

### F-16 — Zona waktu
- **Lokasi**: `new Date().toISOString().split("T")[0]` di `PenjualanForm` (tanggal default), `getPenjualanSummaryForCurrentUser` (penjualan hari ini), halaman delivery-order (tanggal kirim/terima).
- **Masalah**: memakai UTC; antara 00:00–07:00 WIB tanggal yang dihasilkan adalah hari sebelumnya.
- **Perbaikan**: helper `todayWIB()` memakai `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })`.
- **Status: ✅ Diperbaiki**: `todayWIB()`/`toDateWIB()` di `helper/format.ts` menggantikan semua `new Date().toISOString().split("T")[0]`. Nomor dokumen DB juga memakai tanggal WIB.

### F-18 — Angka laporan tidak konsisten
- **Lokasi**: RPC `sum_penjualan_total` & `piutang_summary` (pakai `total`, bukan `total_akhir`), `dashboard.service.ts` (filter `created_at`), halaman laporan (filter `tanggal`), `getRecentSales` (menampilkan `total`).
- **Dampak**: omzet dashboard tidak memperhitungkan diskon/pajak; nominal piutang dashboard ≠ halaman piutang.
- **Perbaikan**: satu definisi — nilai tagihan = `COALESCE(total_akhir, total)`, tanggal bisnis = `tanggal`.
- **Status: ✅ Diperbaiki**: omzet = Σ `COALESCE(total_akhir,total)` penjualan ≠ Batal; pengeluaran = Σ pembelian ≠ Decline; piutang = Σ sisa > 0 penjualan ≠ Batal; filter kolom `tanggal` (WIB). Diterapkan di RPC dashboard (`sql/migrations/20260930d_remaining_findings.sql`), `dashboard.service.ts`, total laporan pembelian (sebelumnya ikut menjumlah Decline), dan "Total Akhir"/"Total Tagihan" di dialog detail penjualan & piutang.

### F-19 — Presisi kolom uang
- **Lokasi**: `penjualan_detail.harga/subtotal`, `riwayat_pembayaran.jumlah`, `supplier_produk.harga_*` = `DECIMAL(10,2)` (maks ±99.999.999,99), sedangkan aplikasi memvalidasi hingga `14,2`.
- **Dampak**: baris penjualan/pembayaran ≥ Rp100 juta gagal disimpan (numeric overflow) — di tengah transaksi non-atomik (F-04).
- **Perbaikan**: `ALTER COLUMN ... TYPE DECIMAL(14,2)`.
- **Status: ✅ Diperbaiki** di `sql/migrations/20260930b_fix_high_priority_data.sql` (`penjualan_detail.harga/subtotal`, `riwayat_pembayaran.jumlah`, `supplier_produk.harga_*`).

### F-20 — Pembayaran piutang
- **Lokasi**: `addPiutangPayment` ([penjualan.service.ts:954-1009](../app/services/penjualan.service.ts#L954-L1009)).
- **Masalah**: read-modify-write di client (dua admin membayar bersamaan → `total_dibayar` saling timpa); validasi "tidak melebihi sisa" hanya di dialog; jika `total_akhir` null perhitungan sisa salah; pembayaran untuk penjualan `Batal` tidak dicegah di service.
- **Perbaikan**: RPC `add_payment(penjualan_id, ...)` dengan `SELECT ... FOR UPDATE`, hitung ulang `total_dibayar = SUM(riwayat_pembayaran)`.
- **Status: ✅ Diperbaiki**: RPC `add_penjualan_payment` (admin, `FOR UPDATE`, jumlah > 0 dan ≤ sisa, tolak penjualan Batal/sudah lunas, tagihan = `COALESCE(total_akhir, total)`). `total_dibayar` = nilai lama + jumlah (bukan SUM riwayat, karena pembayaran awal saat transaksi dibuat tidak tercatat di `riwayat_pembayaran`).

### F-21 — Batal DO berdiri sendiri
- **Lokasi**: [app/dashboard/admin/transaksi/delivery-order/page.tsx:552-558](../app/dashboard/admin/transaksi/delivery-order/page.tsx#L552-L558).
- **Masalah**: status DO menjadi `Batal` tetapi penjualan tetap aktif dan stok tidak kembali. Sebaliknya `cancelPenjualan` membatalkan DO. Perlu keputusan bisnis: DO batal = kirim ulang (buat DO baru) atau batal penjualan.
- **Status: ✅ Diperbaiki (keputusan 2026-09-30: DO batal = penjualan batal)**: tombol Batal di halaman DO memanggil `cancel_penjualan` setelah konfirmasi.

### F-22 — Cancel penjualan tidak idempoten
- **Lokasi**: `app/api/penjualan/cancel/route.ts` (sudah dihapus).
- **Masalah**: cek `status === 'Batal'` lalu kembalikan stok lalu update status — dua request bersamaan sama-sama lolos cek → stok dikembalikan 2×. Jika update status gagal setelah stok dikembalikan, request ulang mengembalikan stok lagi.
- **Perbaikan**: update bersyarat `update ... set status='Batal' where id=? and status<>'Batal' returning` terlebih dahulu, baru kembalikan stok — atau RPC atomik.
- **Status: ✅ Diperbaiki**: RPC `cancel_penjualan` (admin, atau staff pemilik; `FOR UPDATE`; sudah Batal = no-op). Rute API service-role dihapus. Catatan terbuka: membatalkan penjualan yang sudah dibayar tidak mencatat pengembalian dana (`riwayat_pembayaran` tetap ada).

### F-24 — `next.config.ts` ganda
- **Lokasi**: [next.config.ts](../next.config.ts).
- **Masalah**: `module.exports = withBundleAnalyzer({})` **dan** `export default nextConfig`. Config efektif kemungkinan objek kosong, sehingga `outputFileTracingIncludes` (Chromium + font) hilang — saat ini tertolong `vercel.json` `includeFiles`.
- **Perbaikan**: `export default withBundleAnalyzer(nextConfig)` dengan `import bundleAnalyzer from "@next/bundle-analyzer"`.
- **Status: ✅ Diperbaiki**: satu `export default withBundleAnalyzer(nextConfig)`. `npm run build` lulus.

### F-25 — Kode supplier
- **Lokasi**: [app/services/supplier.service.ts:13-35](../app/services/supplier.service.ts#L13-L35).
- **Masalah**: mengambil kode terbesar dengan urutan **teks** (`"SUP-999" > "SUP-1000"`), sehingga setelah SUP-1000 generator selalu menghasilkan SUP-1000 → UNIQUE violation. Juga race antar admin. Cek duplikat nama memakai `ilike` (karakter `%`/`_` jadi wildcard).
- **Perbaikan**: sequence DB + default kolom.
- **Status: ✅ Diperbaiki** di `sql/migrations/20260930d_remaining_findings.sql`: sequence `supplier_kode_seq` + RPC `generate_supplier_code()` khusus admin. Diuji: SUP-999 → SUP-1000 → SUP-1001.

## ⚪ Rendah / kebersihan

- **F-17** — Search disisipkan ke string `.or()` (`no_invoice.ilike.%${term}%`) di beberapa halaman/service; karakter `,()` merusak query. RLS membatasi dampak. Escape atau gunakan `ilike` terpisah / RPC search.
- **F-23** — `app/lib/rate-limit.ts` menyimpan counter di `Map` per instance; di Vercel tidak berlaku lintas instance. Kunci memakai `x-forwarded-for` (bisa dipalsukan di luar Vercel). Pakai Upstash/Vercel KV bila dibutuhkan.
- **F-26** — [components/dashboard/Sidebar.tsx:47-50](../components/dashboard/Sidebar.tsx#L47-L50) menampilkan menu admin bila role gagal dimuat (hanya UI). Menu `Piutang` punya `href` berakhiran spasi di [constants/menu.ts](../constants/menu.ts).
- **F-27** — `produk.stok` masih diisi/ditampilkan (`DialogTambahProduk` menjumlah stok saat duplikat) padahal stok riil ada di `supplier_produk.stok`; tabel `inventory` & `stock_adjustments` tidak dipakai. Putuskan: hapus, atau jadikan `stock_adjustments` sebagai log mutasi stok.
- **F-28** — (Sebagian ✅: `getAllPenjualan` & `getPiutang` dihapus.) `getAllPenjualan` mengambil **seluruh** `penjualan_detail` tanpa filter; `getPiutang`, `getAllPembelian`, list master memakai `select("*")` tanpa pagination; beberapa halaman memakai `count: "planned"` (estimasi, pagination bisa salah). `getAccessToken()` selalu `refreshSession()` pada setiap panggilan PDF.
- **F-29** — (Sebagian ✅: `error.stack` tidak lagi dikirim; `lib/pdf-test.ts` dihapus.) `generate-invoice` mengembalikan `error.stack` ke client; `lib/pdf-test.ts`, `app/hooks/usePembelian.ts`, `app/Distributor/Pengiriman/page.tsx` (di luar `/dashboard`, placeholder) adalah kode mati; `app/api/auth/logout` menghapus cookie `auth-token` yang tidak dipakai Supabase; banyak dokumen TODO/FIX lama di root; `README.md` masih template; belum ada test otomatis maupun histori migrasi SQL.

- **F-30 (🟠, ditemukan 2026-09-30)** — **Skema produksi berbeda dari `supabase-schema.sql`**. Saat migrasi dijalankan,
  `generate_invoice_number()` ternyata tidak ada di DB produksi (fungsi & sequence penomoran ditambahkan ke file skema di
  commit `298fef6` tetapi tidak pernah diterapkan). Akibatnya client memakai fallback `INV/ERR/<timestamp>`, `NPB/ERR/…`,
  `DO/ERR/…`, `ERR/<timestamp>` (lihat F-13). Fungsi lain (`is_admin`, `sum_*`, `piutang_summary`, stok, trigger) sudah ada.
  **Status:** ✅ migrasi `20260930_fix_critical_security.sql` sudah dijalankan di produksi (2026-09-30); daftar fungsi
  `public` terverifikasi lengkap. Sisa: audit nomor `ERR` yang sudah tersimpan, dan jadikan `supabase db dump` produksi
  sebagai baseline skema agar tidak terjadi perbedaan lagi.

- **F-31 (ditemukan 2026-09-30)** — Form penjualan tidak pernah mengisi `total_dibayar`, sehingga penjualan **Lunas** tersimpan dengan `total_dibayar = 0`; halaman Piutang menampilkannya **Belum Lunas** dengan sisa penuh dan bisa ditagih lagi. **Status: ✅** `sql/migrations/20260930d_remaining_findings.sql` mengoreksi data lama; `create_penjualan` mengisi `total_dibayar = total_akhir` untuk status Lunas.
- **F-32 (ditemukan 2026-09-30)** — `LPAD()` Postgres **memotong** teks yang lebih panjang: invoice ke-10000 menjadi `1000`, supplier ke-1000 menjadi `SUP-100` → bentrok. **Status: ✅** `pad_number()` dan semua generator nomor didefinisikan ulang di `sql/migrations/20260930d_remaining_findings.sql`.
- **F-33 (ditemukan 2026-09-30)** — `sum_penjualan_total`, `sum_pembelian_total`, `piutang_summary` bisa dipanggil staff → staff melihat omzet & piutang seluruh toko. **Status: ✅** kini khusus admin.
- **F-34 / A4 (2026-09-30)** — Membatalkan penjualan yang sudah dibayar tidak mencatat pengembalian dana. **Status: ✅** kolom `riwayat_pembayaran.tipe` (`pembayaran`|`refund`); `cancel_penjualan` mencatat refund sebesar `total_dibayar` lalu menyetel `total_dibayar = 0`. Riwayat (termasuk refund) tampil di dialog detail penjualan.
- **Catatan lain**: `DialogDetailPiutang` memanggil `useState` setelah `return null` (melanggar aturan Hooks) — ✅ diperbaiki.

---

## Rekomendasi urutan perbaikan
1. **Tutup celah akses** (murah, dampak besar): F-02 (matikan signup), F-01 (hapus fallback `user_metadata`), F-03 (revoke RPC stok mentah).
2. **Hentikan korupsi data yang sedang terjadi**: F-05, F-12, F-11, F-19, F-06 (ubah FK ke RESTRICT + soft delete).
3. **Pindahkan transaksi ke RPC atomik**: `create_penjualan`, `cancel_penjualan`, `receive_pembelian`, `decline_pembelian`, `add_payment` (menyelesaikan F-04, F-07, F-13, F-20, F-22 sekaligus).
4. PDF berbasis ID dari DB (F-08, F-09), konsistensi laporan (F-18), zona waktu (F-16).
5. Kebersihan (F-15, F-24, F-25, F-17, F-23, F-26–F-29).
