# CLAUDE.md — Sembako32 (Distributor Sembako)

Aplikasi internal gudang/distributor sembako: master data (produk, supplier, harga, pelanggan),
transaksi (pembelian, penjualan, piutang, delivery order) dan laporan PDF.
Bahasa domain & UI: **Bahasa Indonesia**. Pertahankan penamaan Indonesia (penjualan, pembelian, pelanggan, dll).

Dokumen acuan detail:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arsitektur, skema DB, auth, alur bisnis end-to-end.
- [docs/FEATURE-GUIDE.md](docs/FEATURE-GUIDE.md) — langkah baku menambah fitur/halaman/tabel/API/PDF.
- [docs/FINDINGS.md](docs/FINDINGS.md) — temuan bug, risiko keamanan, dan utang teknis (dengan prioritas).

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript strict, Tailwind v4, komponen shadcn/Radix di `components/ui`.
- Supabase (Postgres + Auth + Realtime + RLS). **Tidak ada backend service layer** — hampir semua query
  dijalankan langsung dari browser memakai anon key + sesi user; keamanan data bergantung pada **RLS**.
- PDF: Puppeteer (`puppeteer-core` + `@sparticuz/chromium`) di route `app/api/generate-*`; sebagian PDF
  piutang dibuat di client dengan jsPDF (`helper/pdfExport.ts`).
- Deploy: Vercel (lihat `vercel.json`, cron `/api/cron/keepalive` harian).

## Perintah
- `npm run dev` (pakai `--webpack`), `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- Tidak ada test suite. Verifikasi = `npx tsc --noEmit` + `npm run lint` + uji manual di browser.
- Env (`.env.local`, gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `PDF_DEBUG_SCREENSHOT`, opsional `NEXT_PUBLIC_BASE_URL`, `PUPPETEER_EXEC_PATH`.
  Jangan pernah membaca/menampilkan nilai env.

## Peta folder
| Path | Isi |
|---|---|
| `app/dashboard/admin/**` | Halaman admin (client components, kecuali `transaksi/penjualan/tambah` = server component) |
| `app/dashboard/staff/**` | Halaman staff (hanya penjualan milik sendiri) |
| `app/api/**` | Route handler: PDF generator, inventory report, sync-role, cron |
| `app/services/*.service.ts` | Fungsi akses data Supabase **sisi client** (browser client `app/lib/supabase.ts`) |
| `app/types/*.ts` | Tipe domain (snake_case = kolom DB, camelCase = field turunan/tampilan) |
| `app/lib/` | `supabase.ts` (browser client), `api-guard.ts` (requireAuth/requireAdmin), `rate-limit.ts`, `auth-client.ts` |
| `lib/` | `supabase-admin.ts` (service role — **server only**), `supabase-server.ts`, util Puppeteer/font PDF |
| `lib/pdf/` | Render PDF dokumen penjualan + loader data dari DB (`penjualan-data.ts`) + helper route |
| `components/<fitur>/` | Tabel + Dialog per fitur (`TabelX`, `DialogTambahX`, `DialogEditX`, `DialogDetailX`) |
| `hooks/` | `useDebounce`, `useBatchedRefresh`, `useCachedList`, `useUserRole`, `useAuth` |
| `constants/menu.ts` | Menu sidebar per role — **wajib diupdate saat menambah halaman** |
| `supabase-schema.sql` | Skema dasar (tabel, view, RPC, RLS) |
| `sql/migrations/*.sql` | Migrasi berurutan setelah skema dasar (jalankan manual di Supabase SQL Editor) |
| `lib/supabase-server.ts` | `getServerUserRole()` untuk Server Component (user terverifikasi + role dari tabel `users`) |

## Aturan kerja (wajib)
1. **Ikuti pola yang ada**: halaman list = client component + query Supabase langsung + pagination `range()` +
   `useDebounce` untuk search + realtime channel `postgres_changes` → `useBatchedRefresh`. Mutasi lewat `app/services/*`.
   Feedback via `useStatus().showStatus(...)` dan konfirmasi via `useConfirm()`.
2. **Stok ada di `supplier_produk.stok`**, bukan `produk.stok` (kolom lama, tidak ikut transaksi). Ubah stok hanya
   lewat RPC. `increase_stock`/`decrease_stock` **hanya untuk admin/service role** (qty > 0). Alur yang dipakai staff
   harus lewat RPC tingkat tinggi yang atomik. RPC transaksi yang ada: `create_penjualan`, `cancel_penjualan`,
   `add_penjualan_payment`, `create_pembelian`, `receive_pembelian`, `decline_pembelian`. Staff **tidak punya akses
   tulis langsung** ke `penjualan`/`penjualan_detail`/`riwayat_pembayaran`/`delivery_orders` (RLS hanya SELECT).
3. **Setiap perubahan DB** = file baru `sql/migrations/YYYYMMDD[b|c…]_<nama>.sql` (urut alfabetis = urut eksekusi; beberapa migrasi di hari yang sama pakai sufiks `b`, `c`) (idempoten: `CREATE OR REPLACE`,
   `IF NOT EXISTS`). Tabel baru wajib RLS + policy (pola `is_admin()`), trigger `updated_at`, index FK.
   RPC `SECURITY DEFINER` wajib cek role di dalam fungsi dan `REVOKE ... FROM PUBLIC, anon`.
   Uji SQL bisa dengan Docker `postgres:15-alpine` + stub skema `auth` (lihat docs/FEATURE-GUIDE.md §6).
4. **Role**: jangan pernah membaca `user_metadata.role` (bisa diubah user). Sumber kebenaran = tabel `public.users`;
   `app_metadata.role` hanya cache (disinkronkan saat login lewat `/api/auth/sync-role`). API memakai
   `requireAuth`/`requireAdmin` (role dari DB); Server Component yang memakai `supabaseAdmin` wajib memanggil
   `getServerUserRole()` sendiri. Tidak ada registrasi publik — akun dibuat admin di Supabase Dashboard.
5. **Route API baru**: selalu `requireAuth`/`requireAdmin` dari `app/lib/api-guard.ts`; pakai `supabaseAdmin` hanya
   di server dan lakukan cek kepemilikan sendiri (service role mem-bypass RLS). Escape semua data ke HTML PDF dengan `escapeHtml`.
6. Uang: kolom `DECIMAL(14,2)`; validasi dengan pola `assertValidMoney`. Pajak = 11% dari (subtotal − diskon).
   Nilai yang dipakai untuk tagihan = `total_akhir` (fallback `total`).
7. Status enum (harus sama persis dengan CHECK constraint DB):
   penjualan `Lunas | Belum Lunas | Batal`; pembelian `Pending | Completed | Decline`;
   delivery_orders `Draft | Dikirim | Diterima | Batal`; `metode_pengambilan` `Ambil Langsung | Diantar`.
8. Sebelum mengubah alur transaksi/stok/role, baca [docs/FINDINGS.md](docs/FINDINGS.md) — banyak alur belum atomik.
9. Jangan menyentuh `.env*`, jangan commit tanpa diminta.
10. **Tanggal**: pakai `todayWIB()` / `toDateWIB()` dari `helper/format.ts`, jangan `toISOString().split("T")[0]` (UTC).
11. **PDF baru**: route menerima ID saja dan memuat data dari DB (lihat `lib/pdf/`); jangan merender data dari body request.
12. **Nomor dokumen** hanya dibuat di dalam RPC saat simpan. Padding angka di SQL pakai `pad_number()`, bukan `LPAD` (memotong).
