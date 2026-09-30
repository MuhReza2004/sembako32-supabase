# 2026-09-30 — Perbaikan Keamanan Kritis (F-01, F-02, F-03, F-10)

Referensi temuan: [docs/FINDINGS.md](../FINDINGS.md). Latar belakang arsitektur: [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Ringkasan

| ID | Masalah | Perbaikan |
|---|---|---|
| F-01 | Role dibaca dari `user_metadata`, yang bisa diubah user sendiri. User biasa bisa lolos cek admin dan mengambil laporan penjualan/pembelian lengkap. | `user_metadata` tidak dipakai lagi. API membaca role dari tabel `users`. Login selalu menyinkronkan role ke `app_metadata`. |
| F-02 | Siapa pun bisa mendaftar dan otomatis menjadi `staff`. | Halaman `/auth/register`, `RegisterForm`, dan `register()` dihapus. **Signup juga harus dimatikan di Supabase** (lihat Langkah Deploy). |
| F-03 | RPC `increase_stock`/`decrease_stock` bisa dipanggil semua user login (dan anon), tanpa validasi qty. | Hanya admin/service role, qty > 0. Staff membuat penjualan lewat RPC baru `create_penjualan` yang atomik. |
| F-10 | Middleware memakai `getSession()` yang tidak memverifikasi token. | Middleware memakai `getUser()` dan API cookie `getAll/setAll`. |

Temuan baru selama deploy: **F-30**. Fungsi penomoran dokumen (`generate_*_number`) dan sequence-nya belum pernah dibuat di database, sehingga aplikasi selama ini memakai nomor cadangan `INV/ERR/<timestamp>`. Migrasi ini membuatnya dan melanjutkan nomor dari data yang ada.

## Perubahan perilaku yang terlihat pengguna

- **Tidak ada lagi halaman registrasi.** Akun baru dibuat admin di Supabase Dashboard → Authentication → Add user (otomatis `staff`). Promosi ke admin: `update users set role = 'admin' where email = '...'`.
- **Penyimpanan penjualan sekarang atomik.** Kalau satu item gagal (mis. stok kurang), seluruh penjualan dibatalkan. Tidak ada lagi penjualan setengah tersimpan.
- **Harga item dihitung di server** dari harga normal/grosir di menu Harga Produk. Karena form memang tidak mengizinkan harga manual, hasilnya sama.
- **Nomor dokumen** (`INV`, `NPB`, `DO`, `TT`) memakai sequence database dengan tanggal WIB. Nomor tidak direset per bulan.
- Staff yang membuka URL admin dialihkan ke dashboard staff (tidak berubah, tapi sekarang tidak bisa diakali lewat metadata).

## File yang berubah

**Database**
- `sql/migrations/20260930_fix_critical_security.sql` (baru). Isinya:
  - Bagian 0: prasyarat `is_admin()`/`current_user_role()`, sequence, fungsi penomoran, sinkronisasi sequence dari nomor yang ada (format lama & baru).
  - Bagian 1: `increase_stock`/`decrease_stock` dengan cek role dan qty.
  - Bagian 2: RPC `create_penjualan(p_data jsonb)`.
  - Bagian 3: cabut EXECUTE dari `PUBLIC`/`anon`.
  - Dibungkus `BEGIN`/`COMMIT`, idempoten.
- `supabase-schema.sql`: catatan bahwa migrasi di `sql/migrations/` dijalankan setelah skema dasar.

**Auth & akses**
- `middleware.ts`: `getUser()`, role hanya dari `app_metadata` (fallback tabel `users`), route `/auth/register` dihapus dari matcher.
- `app/lib/api-guard.ts`: `requireAuth`/`requireAdmin` selalu membaca role dari tabel `users`.
- `app/api/auth/sync-role/route.ts`, `hooks/useUserRole.ts`, `components/auth/LoginForm.tsx`: hapus fallback `user_metadata`. Login selalu memanggil sync-role.
- `lib/supabase-server.ts` (baru): `getServerUserRole()` untuk Server Component.
- `app/dashboard/admin/transaksi/penjualan/tambah/page.tsx`: cek admin di server sebelum membaca data dengan service role.
- Dihapus: `app/auth/register/page.tsx`, `components/auth/RegisterForm.tsx`, `register()` di `app/services/auth.service.ts`.

**Penjualan**
- `app/services/penjualan.service.ts`: `createPenjualan` sekarang satu panggilan `supabase.rpc("create_penjualan")`.

**Dokumentasi**
- `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE-GUIDE.md`, `docs/FINDINGS.md` (baru): acuan codebase, panduan fitur, dan daftar temuan.

## Langkah deploy (urutan penting)

Kode ini memanggil RPC `create_penjualan`. **Migrasi harus sudah ada di database production sebelum kode dideploy**, kalau tidak semua pembuatan penjualan gagal. Sebaliknya, jika migrasi sudah jalan tapi kode lama masih live, staff tidak bisa membuat penjualan. Jadi lakukan langkah 1–4 berdekatan.

1. **Pastikan project Supabase yang benar.**
   - `.env.local` → `thbdyzairfkwkruslivl` (development).
   - `.env.prod` → `dwdgixftljajyafeljpc` (production).
   - Cocokkan dengan Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SUPABASE_URL` (Production).
2. **Jalankan migrasi** `sql/migrations/20260930_fix_critical_security.sql` di SQL Editor project **production**. Aman dijalankan ulang. NOTICE "Lewati ..." normal.
3. **Matikan signup**: Supabase Dashboard (production) → Authentication → Sign In / Providers → matikan *Allow new users to sign up*.
4. **Push & deploy** kode ini ke Vercel.
5. **Verifikasi fungsi ada:**
   ```sql
   SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' ORDER BY 1;
   ```
   Harus berisi `create_penjualan(jsonb)`, `is_service_role()`, keempat `generate_*_number()`.
6. **Audit nomor ERR lama:**
   ```sql
   SELECT id, tanggal, no_invoice, no_npb, no_do, no_tanda_terima FROM penjualan
   WHERE no_invoice LIKE '%ERR%' OR no_npb LIKE '%ERR%' OR no_do LIKE '%ERR%' OR no_tanda_terima LIKE '%ERR%'
   ORDER BY tanggal;
   ```
7. **Audit akun**: `SELECT id, email, role, created_at FROM users ORDER BY created_at DESC;` Hapus akun yang tidak dikenal (mungkin mendaftar sendiri lewat halaman register lama).

## Checklist uji setelah deploy

- [ ] Login admin → masuk `/dashboard/admin`.
- [ ] Login staff → buat penjualan "Ambil Langsung". Tersimpan, nomor `INV/S32/YYYY/MM/NNNN` (bukan `ERR`), stok berkurang.
- [ ] Staff → buat penjualan "Diantar". Delivery Order status Draft muncul di menu DO.
- [ ] Staff → qty melebihi stok. Muncul error, **tidak ada** penjualan baru tersimpan.
- [ ] Admin → terima pembelian (Pending → Completed). Stok bertambah.
- [ ] Admin/staff → batalkan penjualan. Stok kembali, status Batal.
- [ ] Staff membuka `/dashboard/admin/...` → dialihkan ke dashboard staff.
- [ ] Buka `/auth/register` → 404.
- [ ] Cetak invoice/kwitansi/DO → PDF terbentuk.

Catatan: setelah staff menyimpan penjualan, halaman sempat diarahkan ke halaman admin lalu dipantulkan ke dashboard staff. Itu bug lama **F-12** yang belum diperbaiki; data tetap tersimpan.

## Pengujian yang sudah dilakukan

- `npx tsc --noEmit` lulus. ESLint bersih untuk file yang diubah.
- Migrasi diuji di PostgreSQL 15 (Docker) dengan stub skema `auth` Supabase, dalam dua kondisi: skema lengkap, dan skema mirip production (tanpa sequence/fungsi penomoran, dengan data nomor format lama dan `ERR`). Hasil:
  - Migrasi sukses dan aman dijalankan ulang.
  - Sequence melanjutkan nomor tertinggi (`INV …/0017` → `0018`, `NPB …/0021` → `0022`, `DO …/0009` → `0010`, TT lama `0012/S32/…` → `TT/S32/…/0013`).
  - anon, staff, dan user tanpa profil ditolak saat mengubah stok; admin & service role berhasil; qty ≤ 0 ditolak.
  - `create_penjualan`: harga dari client diabaikan; item kedua stok kurang → seluruh transaksi rollback; nomor bentrok di-retry; Diantar membuat DO.
- **Belum diuji**: alur di browser dan di project Supabase production.

## Rollback

- **Kode**: revert commit ini lalu deploy ulang.
- **Database**: kode lama membutuhkan staff bisa memanggil `decrease_stock`. Jika kode di-rollback, kembalikan sementara:
  ```sql
  -- HANYA untuk rollback darurat; membuka kembali celah F-03.
  CREATE OR REPLACE FUNCTION public.decrease_stock(p_supplier_produk_id UUID, p_qty INTEGER)
  RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE new_stok INTEGER;
  BEGIN
    UPDATE supplier_produk SET stok = stok - p_qty
    WHERE id = p_supplier_produk_id AND stok >= p_qty RETURNING stok INTO new_stok;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stok tidak mencukupi atau produk tidak ditemukan'; END IF;
    RETURN new_stok;
  END; $$;
  ```
  Fungsi penomoran, sequence, dan `create_penjualan` boleh dibiarkan karena tidak mengganggu kode lama.

## Pekerjaan lanjutan (belum termasuk)

F-05 (stok ganda saat pembelian diterima ulang), F-12 (redirect staff), F-11 (setval NPB/DO di `supabase-schema.sql`), F-19 (presisi kolom uang), F-07 (cabut UPDATE langsung staff pada penjualan), F-06 (cascade delete).
