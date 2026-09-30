# Arsitektur & Alur Sistem — Sembako32

> Acuan teknis. Dibuat dari analisis kode pada commit `9b98b3e` (2026-09-30).
> Jika kode berubah, perbarui bagian yang relevan.

## 1. Gambaran besar

```
Browser (React client components)
  │  @supabase/ssr createBrowserClient (anon key + JWT user di cookie)
  ├──────────────► Supabase PostgREST / RPC / Realtime   ← keamanan = RLS + is_admin()
  │
  └──fetch + Bearer token──► Next.js Route Handlers (app/api/*)
                                 │ requireAuth / requireAdmin (app/lib/api-guard.ts)
                                 ├─► supabaseAdmin (service role, bypass RLS)
                                 └─► Puppeteer → PDF

middleware.ts  → proteksi /dashboard/* dan redirect /auth/* berdasar role
```

Karakteristik penting:
- **Logika bisnis ada di client** (`app/services/*.service.ts`) dan dieksekusi sebagai beberapa request terpisah
  (tidak ada transaksi DB). Lihat FINDINGS untuk konsekuensinya.
- Server hanya dipakai untuk: PDF, pembatalan penjualan (`/api/penjualan/cancel`), laporan inventory,
  sinkronisasi role, cron keepalive, dan satu halaman server (`admin/transaksi/penjualan/tambah`).
- React Query hanya dipakai di dashboard admin (`app/hooks/useDashboard.ts`). Halaman lain memakai `useState`
  + fetch manual + cache modul (`produkCache`, `supplierCache`, dst. TTL 5 menit di service).

## 2. Auth & Role

### Sumber role
- Tabel `public.users(id, email, role 'admin'|'staff')`. Trigger `on_auth_user_created` membuat baris
  `role='staff'` untuk setiap user baru di `auth.users`.
- Tidak ada UI manajemen user dan **tidak ada registrasi publik** (halaman `/auth/register` dihapus). Akun dibuat di
  Supabase Dashboard → Authentication → Add user (otomatis `staff`); promosi ke admin manual di DB (`update users set role='admin'`).
- **`user_metadata.role` tidak pernah dipakai** (bisa diubah user sendiri). `app_metadata.role` hanya cache dari tabel `users`.
- Role disalin ke JWT `app_metadata.role` oleh `POST /api/auth/sync-role` (dipanggil `LoginForm` bila role belum ada di token).

### Alur login (`components/auth/LoginForm.tsx`)
1. `signInWithPassword` → `setSession`.
2. Selalu `POST /api/auth/sync-role` (salin `users.role` → `app_metadata.role`); jika role berubah → `refreshSession()`.
3. Fallback: baca `users` via `getUserById`.
4. Redirect `/dashboard/admin?login=success` atau `/dashboard/staff?login=success` (`LoginSuccessListener` menampilkan toast lalu menghapus query).

### Lapisan proteksi
| Lapisan | File | Cara kerja |
|---|---|---|
| Middleware | `middleware.ts` | `getUser()` (JWT diverifikasi ke Supabase Auth); tanpa user → `/auth/login`; `/dashboard/admin/*` butuh role admin (`app_metadata.role`, fallback tabel `users`) |
| Server Component | `lib/supabase-server.ts` `getServerUserRole()` | Wajib di halaman server yang memakai `supabaseAdmin` (contoh `admin/transaksi/penjualan/tambah`) |
| Sidebar | `components/dashboard/Sidebar.tsx` + `constants/menu.ts` | Filter menu per role (UI saja) |
| API | `app/lib/api-guard.ts` | Bearer token (`supabaseAdmin.auth.getUser`) atau cookie; role **selalu dari tabel `users`** |
| Database | RLS di `supabase-schema.sql` | `is_admin()` membaca `public.users.role` — **ini satu-satunya lapisan yang benar-benar tepercaya** |
| Sesi | `SessionExpiryWatcher.tsx` | Timer sampai `expires_at`, lalu signOut + dialog |

Pemanggilan API dari client: `const token = await getAccessToken()` (`app/lib/auth-client.ts`, selalu `refreshSession`)
lalu `fetch('/api/...', { headers: { Authorization: 'Bearer ' + token } })`.

### Matriks akses RLS (ringkas)
| Tabel | Admin | Staff |
|---|---|---|
| users | ALL | baca/ubah profil sendiri (tanpa ubah role) |
| produk, pelanggan, supplier_produk | ALL | SELECT semua |
| suppliers, inventory, stock_adjustments, pembelian, pembelian_detail | ALL | — |
| penjualan | ALL | SELECT/INSERT/UPDATE milik sendiri (`created_by = auth.uid()`) |
| penjualan_detail, riwayat_pembayaran, delivery_orders | ALL | via penjualan milik sendiri |
| RPC `increase_stock`, `decrease_stock` | ✔ (qty > 0) | ✖ (ditolak di dalam fungsi; juga boleh service role) |
| RPC `create_penjualan(p_data jsonb)` | ✔ | ✔ (atomik; harga & total dihitung server) |
| RPC `generate_*_number`, `sum_*`, `piutang_summary` | ✔ | ✔ (SECURITY DEFINER; anon dicabut) |

## 3. Model data

```
suppliers 1─* supplier_produk *─1 produk          (supplier_produk = harga beli/jual + STOK per supplier)
pelanggan 1─* penjualan 1─* penjualan_detail *─1 supplier_produk
                   │ 1─* riwayat_pembayaran
                   │ 1─0..1 delivery_orders
suppliers 1─* pembelian 1─* pembelian_detail *─1 supplier_produk
auth.users 1─1 users ; penjualan.created_by → auth.users
```

Catatan kolom:
- `supplier_produk`: `harga_beli`, `harga_jual_normal`, `harga_jual_grosir`, `harga_jual` (legacy, disinkronkan = normal), `stok`.
- `penjualan`: `total` (subtotal item), `diskon`, `pajak_enabled`, `pajak`, `total_akhir` (yang ditagih), `total_dibayar`,
  nomor dokumen `no_invoice`, `no_npb`, `no_do`, `no_tanda_terima`, `tanggal_jatuh_tempo`, `metode_pembayaran` + data rekening.
- `produk.stok`, tabel `inventory`, `stock_adjustments`: **tidak dipakai alur transaksi** (sisa migrasi Firebase).
- Aturan hapus (FK): pelanggan/supplier/harga produk yang **sudah dipakai transaksi tidak bisa dihapus** (`ON DELETE RESTRICT`,
  error `23503` → pesan "nonaktifkan"). `supplier_produk` yang belum dipakai ikut terhapus bersama supplier/produknya.
  Menghapus penjualan/pembelian tetap menghapus detail, pembayaran, dan DO-nya (CASCADE).
- Semua kolom uang `DECIMAL(14,2)`.
- View: `inventory_report` (stok = SUM supplier_produk.stok, masuk = pembelian Completed, keluar = penjualan ≠ Batal),
  `produk_stock_summary` (low stock di dashboard, ambang 10).

Penomoran dokumen (RPC + sequence global, tidak reset per bulan):
| Dokumen | Format | RPC |
|---|---|---|
| Invoice | `INV/S32/YYYY/MM/NNNN` | `generate_invoice_number` |
| NPB | `NPB/G001/YYYY/MM/DD/NNNN` | `generate_npb_number` |
| Delivery Order | `DO/S32/YYYY/MM/NNNN` | `generate_do_number` |
| Tanda Terima | `TT/S32/YYYY/MM/NNNN` | `generate_tanda_terima_number` |
| Kode produk / pelanggan | `SKU-xxxxxxxx`, `PLG-…`, `KDP-…` (potongan UUID, client) | — |
| Kode supplier | `SUP-001` (max+1 di client) | — |

## 4. Alur bisnis

### 4.1 Master data (admin)
- **Produk** (`admin/produk`): CRUD `produk`, cek duplikat nama (`ilike`). Kode dari `generateKodeProduk()`.
- **Supplier** (`admin/supplier`): CRUD `suppliers`, cek duplikat nama, kode `SUP-###`.
- **Harga Produk** (`admin/HargaProduk`): CRUD `supplier_produk` (pasangan supplier×produk unik) — di sinilah harga & stok awal ditetapkan.
- **Pelanggan** (`admin/pelanggan`): CRUD `pelanggan`, cek duplikat NIB.
- **Inventory** (`admin/inventory`): `GET /api/inventory-report` (admin, service role, view `inventory_report`).

### 4.2 Pembelian (barang masuk) — admin
```
pembelianForm → createPembelian(status 'Pending')
   insert pembelian → loop insert pembelian_detail   (stok BELUM bertambah karena Pending)
DialogEditPembelian "Terima" (hanya aktif untuk Pending) → updatePembelianAndStock → rpc receive_pembelian
   [atomik, admin] kunci baris; tolak bila status ≠ Pending; set no_do/no_npb/invoice + 'Completed';
   per produk: stok += qty, harga_beli = harga pembelian terakhir
DialogEditPembelian "Tolak" → updatePembelianStatus('Decline') → rpc decline_pembelian
   [atomik, admin] Pending → Decline; Completed → stok -= qty (gagal utuh bila stok sudah terpakai) → Decline;
   Decline → no-op
```
File: `components/pembelian/*`, `app/services/pembelian.service.ts`, halaman `admin/transaksi/pembelian`.

### 4.3 Penjualan (barang keluar) — admin & staff
```
PenjualanForm (components/penjualan/PenjualanForm.tsx)
  on mount / ganti metode_pengambilan: pre-generate no_invoice, no_npb, no_tanda_terima (+ no_do jika Diantar)
  hitung: subTotal = Σ item.subtotal; diskon ≤ subTotal; pajak = 11% × (subTotal−diskon); total_akhir
  konfirmasi → createPenjualan(finalData)
createPenjualan (penjualan.service.ts) → supabase.rpc("create_penjualan", { p_data })   ← SATU transaksi DB
  RPC (sql/migrations/20260930_fix_critical_security.sql):
  0. cek auth.uid() + role admin/staff di tabel users; validasi header & items (qty > 0)
  1. insert penjualan (nomor dari form atau generate; retry 3× bila nomor bentrok)
  2. per item: SELECT supplier_produk FOR UPDATE → cek stok → harga = harga_jual_normal/grosir sesuai harga_tipe
     (harga/subtotal dari client DIABAIKAN) → kurangi stok → insert penjualan_detail
  3. hitung total, diskon (≤ total), pajak 11%, total_akhir → update header
  4. jika 'Diantar': insert delivery_orders(status 'Draft', tanggal_kirim = tanggal)
  Gagal di langkah mana pun → seluruh transaksi di-rollback.
  → router.push('/dashboard/admin/transaksi/penjualan')
```
- Harga per item dipilih dari `harga_jual_normal` / `harga_jual_grosir` supplier_produk yang dipilih.
- List: admin `getPenjualanPage` (semua), staff `getPenjualanPageForCurrentUser` (+ filter `created_by`).
- Detail & dokumen: `DialogDetailPenjualan` → `/api/generate-invoice | generate-delivery-order | generate-receipt | generate-documents` (gabungan via pdf-lib).
- **Batal**: `cancelPenjualan` → `POST /api/penjualan/cancel` (service role): cek pemilik/admin → `increase_stock` per detail
  → status `Batal` → DO terkait `Batal`.
- `updatePenjualan` / `deletePenjualan` ada di service tetapi tidak ada UI yang memanggil edit (`tambah?id=`) — lihat FINDINGS.

### 4.4 Piutang — admin
- Halaman `admin/transaksi/piutang` mengambil penjualan ≠ Batal, menurunkan status dari `total_dibayar` vs `total_akhir`.
- `DialogBayarPiutang` → validasi 0 < jumlah ≤ sisa → `addPiutangPayment`: insert `riwayat_pembayaran`,
  update `penjualan.total_dibayar` & status (`Lunas` bila sisa ≤ 0).
- Export PDF tabel/detail piutang: client-side jsPDF (`helper/pdfExport.ts`).

### 4.5 Delivery Order — admin
- `admin/transaksi/delivery-order`: list + filter; transisi status `Draft → Dikirim (tanggal_kirim) → Diterima (tanggal_terima)`;
  tombol `Batal` hanya mengubah status DO (tidak membatalkan penjualan/stok).
- Cetak: `/api/generate-delivery-order` (surat jalan) dan `/api/generate-bast` (berita acara serah terima, saat Diterima).

### 4.6 Laporan — admin
- `admin/laporan/penjualan` & `admin/laporan/pembelian`: list + ringkasan di client; export PDF via
  `/api/generate-sales-report` / `/api/generate-purchase-report` (`requireAdmin`, data diambil server dengan service role).

### 4.7 Dashboard
- Admin (`app/dashboard/admin/page.tsx`): `useDashboardData` (React Query) → `dashboard.service.ts` (count + RPC `sum_*`, `piutang_summary`, `produk_stock_summary`), realtime refresh.
- Staff (`app/dashboard/staff/page.tsx`): `getPenjualanSummaryForCurrentUser` (hitung di client).

## 5. Pembuatan PDF (server)

Pola seragam di setiap `app/api/generate-*/route.ts`:
1. `export const runtime = "nodejs"; export const maxDuration = 60;`
2. `requireAuth`/`requireAdmin` → `rateLimit(key, n, 60_000)` (in-memory per instance).
3. Body JSON dari client. Untuk non-admin: cek kepemilikan berdasarkan nomor dokumen (no_invoice / no_do) via `supabaseAdmin`.
4. Bangun HTML string (semua nilai lewat `safe()` = `escapeHtml`), font Verdana base64 (`lib/pdf-fonts.ts`), logo `public/logo.svg` base64.
5. `puppeteer.launch(await getPuppeteerLaunchOptions())` (`lib/puppeteer.ts`: Chromium sparticuz di Vercel, Chrome/Edge lokal di dev)
   → `setContent` → `waitForPdfFonts` → `page.pdf` → `browser.close()` di `finally`.
6. Response `application/pdf` + `Content-Disposition`.

Laporan (sales/purchase) mengambil data dari DB; invoice/receipt/DO/BAST **merender data dari body request**.
Dokumen debugging PDF lama: `SOLUTION-SUMMARY.md`, `PDF-FIXES.md`, `FIX-IMPLEMENTATION.md`, `MAINTENANCE.md`.

## 6. Pola UI yang dipakai berulang
- Layout dashboard: `app/dashboard/layout.tsx` → `ErrorBoundary > ConfirmProvider > StatusProvider > DashboardShell (Sidebar+Topbar)`.
- `useStatus().showStatus({ title?, message, success, refresh? })` — dialog status; `refresh: true` memanggil `router.refresh()` saat ditutup.
- `useConfirm()({ title, message, confirmText, cancelText })` → `Promise<boolean>`.
- Combobox pencarian: `components/ui/combobox-{pelanggan,produk,supplier-produk}.tsx`.
- Format: `helper/format.ts` (`formatRupiah`, `formatTanggal`).
- Realtime: `supabase.channel(name).on('postgres_changes', {event:'*', schema:'public', table}, scheduleRefresh).subscribe()`,
  cleanup `supabase.removeChannel(channel)`.
