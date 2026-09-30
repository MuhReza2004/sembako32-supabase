# Panduan Menambah Fitur — Sembako32

Checklist baku agar fitur baru konsisten dengan pola yang ada. Contoh berjalan: fitur **"Retur Penjualan"**.

## 0. Tentukan dulu
- **Siapa pengguna?** admin saja, atau staff juga (staff hanya boleh data miliknya — `created_by = auth.uid()`).
- **Menyentuh stok/uang?** Jika ya, pertimbangkan membuat **RPC PL/pgSQL** agar atomik (lihat §3), jangan menambah
  rantai request client baru seperti `createPenjualan` (lihat FINDINGS F-04).
- **Butuh dokumen PDF?** → route `app/api/generate-<nama>` (§5).

## 1. Database (Supabase)
1. Buat file migrasi `sql/migrations/YYYYMMDD_<nama>.sql` (folder baru; saat ini belum ada histori migrasi) dan
   salin juga definisi akhirnya ke `supabase-schema.sql`.
2. Template tabel:
```sql
CREATE TABLE retur_penjualan (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  penjualan_id UUID NOT NULL REFERENCES penjualan(id) ON DELETE RESTRICT,
  tanggal DATE NOT NULL,
  alasan TEXT,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Draft','Disetujui','Batal')) DEFAULT 'Draft',
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_retur_penjualan_penjualan_id ON retur_penjualan(penjualan_id);
ALTER TABLE retur_penjualan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage retur_penjualan" ON retur_penjualan
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_retur_penjualan_updated_at BEFORE UPDATE ON retur_penjualan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
3. Aturan:
   - Uang `DECIMAL(14,2)` (jangan `10,2`). Qty `INTEGER`.
   - FK ke data transaksi historis pakai `ON DELETE RESTRICT`, bukan `CASCADE` (lihat FINDINGS F-06).
   - Status = `TEXT CHECK (...)` + union type TS yang sama persis.
   - Jika perlu realtime: aktifkan tabel di publication `supabase_realtime` (Dashboard → Database → Replication).
   - RPC baru: `SECURITY DEFINER SET search_path = public`, **cek `is_admin()`/kepemilikan di dalam fungsi**,
     validasi `p_qty > 0`, lalu `GRANT EXECUTE ... TO authenticated`. Untuk proses multi-langkah, lakukan semuanya
     dalam satu fungsi agar berada dalam satu transaksi.

## 2. Types — `app/types/<fitur>.ts`
```ts
export type ReturStatus = "Draft" | "Disetujui" | "Batal";
export interface ReturPenjualan {
  id: string; penjualan_id: string; tanggal: string; alasan?: string | null;
  total: number; status: ReturStatus; created_by?: string | null;
  created_at: string; updated_at: string;
  // field turunan untuk tampilan: camelCase
  noInvoice?: string;
}
export type ReturPenjualanFormData = Omit<ReturPenjualan, "id" | "created_at" | "updated_at" | "noInvoice">;
```
Konvensi: kolom DB = snake_case, field tampilan/join = camelCase (`namaPelanggan`, `namaProduk`).

## 3. Service — `app/services/<fitur>.service.ts`
- Import `supabase` dari `@/app/lib/supabase` (browser client). **Jangan** import `lib/supabase-admin` di file client.
- Satu fungsi per operasi: `getXPage({page, perPage, searchTerm, ...})`, `getXById`, `addX`, `updateX`, `deleteX`.
- Pola error: `if (error) { console.error("Error ...:", error); throw error; }`.
- Uang: salin/ekstrak `assertValidMoney` (idealnya pindahkan ke `helper/money.ts` agar tidak duplikat).
- Stok: panggil RPC (`increase_stock`/`decrease_stock` atau RPC baru yang atomik), jangan update kolom `stok` langsung.
- Jika memakai cache modul (seperti `produkCache`), panggil fungsi invalidasi setelah setiap mutasi.

## 4. UI
### Halaman
`app/dashboard/admin/<fitur>/page.tsx` (atau `staff/...`), `"use client"`. Ikuti struktur `app/dashboard/admin/produk/page.tsx`:
```tsx
const [page, setPage] = useState(0); const perPage = 10;
const debouncedSearch = useDebounce(searchTerm, 300);
const fetchData = useCallback(async () => {
  let q = supabase.from("retur_penjualan").select("…", { count: "exact" }).order("created_at", { ascending: false });
  if (debouncedSearch) q = q.ilike("alasan", `%${debouncedSearch}%`);
  const { data, error, count } = await q.range(page * perPage, page * perPage + perPage - 1);
  …
}, [page, debouncedSearch]);
const { schedule } = useBatchedRefresh(fetchData);
useEffect(() => {
  fetchData();
  const ch = supabase.channel("retur-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "retur_penjualan" }, () => schedule())
    .subscribe();                       // subscribe() hanya SEKALI per channel
  return () => { supabase.removeChannel(ch); };
}, [fetchData, schedule]);
```
- Gunakan `{ count: "exact" }` untuk pagination yang akurat (`planned` hanya estimasi).
- Search: hindari memasukkan input user mentah ke `.or("a.ilike.%x%,…")`; minimal escape `,` `(` `)` (lihat FINDINGS F-17).

### Komponen — `components/<fitur>/`
`Tabel<Fitur>.tsx`, `DialogTambah<Fitur>.tsx`, `DialogEdit<Fitur>.tsx`, `DialogDetail<Fitur>.tsx`.
Form memakai `react-hook-form`; komponen dasar dari `components/ui/*`; ikon `lucide-react`.
Feedback: `useStatus().showStatus({ message, success, refresh: true })`; hapus: `await confirm({...})`.

### Menu & akses
1. Tambah entri di `constants/menu.ts` (`roles: ["admin"]` atau `["staff"]`) — `href` tanpa spasi.
2. Route di bawah `/dashboard/admin/*` otomatis diproteksi middleware; tetap andalkan RLS untuk keamanan data.
3. Jika perlu `loading.tsx`, contoh ada di `app/dashboard/admin/loading.tsx`.

## 5. Route API / PDF baru — `app/api/<nama>/route.ts`
```ts
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);          // atau requireAuth + cek kepemilikan
  if (!guard.ok) return guard.response;
  const limit = rateLimit(`pdf:<nama>:${guard.userId}`, 10, 60_000);
  …
  // Ambil data dari DB berdasarkan ID (jangan percaya angka dari body)
  const { data } = await supabaseAdmin.from("…").select("…").eq("id", id).single();
  // HTML: semua nilai lewat escapeHtml; font dari getPdfFontCss(); launch via getPuppeteerLaunchOptions()
  // tutup browser di finally; jangan kirim error.stack ke client
}
```
Client: `const token = await getAccessToken(); fetch("/api/<nama>", { method: "POST", headers: { "Content-Type": "application/json", Authorization: \`Bearer ${token}\` }, body })` → `blob()` → download.

## 6. Verifikasi sebelum selesai
- [ ] `npx tsc --noEmit` dan `npm run lint` bersih.
- [ ] SQL migrasi diuji lokal dulu: `docker run -d --rm --name s32-sqltest -e POSTGRES_PASSWORD=pw postgres:15-alpine`,
      buat stub (`CREATE ROLE anon/authenticated/service_role`, schema `auth` dengan tabel `users` serta fungsi
      `auth.jwt()` yang membaca `current_setting('request.jwt.claims')` dan `auth.uid()`), jalankan `supabase-schema.sql` + semua
      `sql/migrations/*.sql`, lalu uji dengan `SET ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',false);`.
      Di Git Bash set `MSYS_NO_PATHCONV=1` untuk `docker exec ... -f /file.sql`. Catatan: trigger `on_auth_user_created` membuat user sebagai `staff`.
- [ ] Migrasi dijalankan di Supabase (dev → prod) secara manual lewat SQL Editor.
- [ ] Uji sebagai **admin dan staff** (staff tidak boleh melihat/mengubah data orang lain; cek juga via RLS, bukan hanya UI).
- [ ] Jika menyentuh stok: cek `inventory_report` sebelum/sesudah; uji skenario gagal di tengah (qty > stok).
- [ ] Jika menambah halaman: menu muncul di sidebar role yang benar.
- [ ] PDF: uji lokal (`npm run dev`, butuh Chrome/Edge terpasang) dan periksa ukuran > 10 KB.
- [ ] Perbarui `docs/ARCHITECTURE.md` bila alur/skema berubah.
