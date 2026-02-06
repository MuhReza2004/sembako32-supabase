# Maintenance Rutin (Sembako 32)

Dokumen ini berisi jadwal dan checklist maintenance rutin untuk aplikasi Next.js + Supabase + Vercel, termasuk fitur export PDF (Puppeteer).

**Jadwal Rutin**
1. Mingguan (1x per minggu, 30–60 menit)
2. Bulanan (1x per bulan, 1–2 jam)
3. Per rilis (setiap rilis fitur)
4. Kuartalan (1x per 3 bulan)

**Mingguan**
1. Cek Vercel Logs untuk error `500` dan timeout di endpoint PDF:
   - `/api/generate-invoice`
   - `/api/generate-receipt`
   - `/api/generate-delivery-order`
   - `/api/generate-bast`
   - `/api/generate-sales-report`
   - `/api/generate-purchase-report`
2. Cek ukuran PDF hasil export:
   - Invoice normal biasanya > 10 KB.
3. Cek Supabase Logs untuk error query atau RLS.
4. Cek kapasitas database dan storage Supabase.

**Bulanan**
1. Update dependency minor/patch (hindari major tanpa testing):
```bash
npm outdated
npm install
npm run build
```
2. Audit security:
```bash
npm audit
```
3. Review environment variables di Vercel:
   - `NEXT_PUBLIC_BASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
4. Review role dan akses data (RLS) di Supabase.
5. Cek backup database dan lakukan test restore minimal 1x.

**Per Rilis**
1. Jalankan build:
```bash
npm run build
```
2. Smoke test halaman utama dan dashboard admin/staff.
3. Smoke test export PDF (invoice, DO, BAST, laporan).
4. Validasi auth/role (admin dan staff).

**Kuartalan**
1. Review biaya Vercel dan Supabase.
2. Cleanup dependency yang tidak dipakai.
3. Review performa endpoint paling berat (PDF, laporan).
4. Review dokumentasi internal dan SOP operasional.

**Checklist PDF (Quick Check)**
1. Pastikan logo muncul di PDF.
2. Pastikan teks tampil (tidak kosong).
3. Pastikan ukuran PDF tidak terlalu kecil.
4. Pastikan nilai total dan item muncul dengan benar.

**Catatan Produksi**
1. `PDF_DEBUG_SCREENSHOT` sebaiknya `0` atau dihapus di production.
2. Jika ada perubahan besar di PDF, lakukan test di Vercel sebelum release.

**Rollback**
1. Jika error production muncul, rollback ke deploy sebelumnya di Vercel.
2. Dokumentasikan root cause dan langkah perbaikan di changelog internal.
