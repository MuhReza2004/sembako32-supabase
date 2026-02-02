# Migrasi Database ke Supabase

## Status: In Progress

## Data Models yang Ditemukan:

1. **User**: uid, email, role, createdAt
2. **Produk**: id, kode, nama, kategori, satuan, stok, status, createdAt, updatedAt
3. **Penjualan**: id, tanggal, pelangganId, catatan, noInvoice, noNPB, noDO, metodePengambilan, total, totalDibayar, status, riwayatPembayaran, createdAt, updatedAt, items
4. **PenjualanDetail**: id, penjualanId, supplierProdukId, qty, harga, subtotal, namaProduk, satuan, hargaJual
5. **Pelanggan**: id, idPelanggan, kodePelanggan, namaPelanggan, namaToko, nib, alamat, noTelp, email, status, createdAt, updatedAt
6. **Supplier**: id, kode, nama, alamat, telp, status, createdAt, updatedAt
7. **SupplierProduk**: id, supplierId, produkId, hargaBeli, hargaJual, stok, createdAt
8. **Pembelian**: id, supplierId, tanggal, noDO, noNPB, invoice, total, status, createdAt, updatedAt, items, namaSupplier
9. **PembelianDetail**: id, pembelianId, supplierProdukId, qty, harga, subtotal, namaProduk, satuan
10. **Inventory**: id, produkId, supplierId, stok, createdAt, updatedAt
11. **StockAdjustment**: id, produkId, adjustmentType, quantity, reason, createdAt, createdBy
12. **LowStockAlert**: produkId, nama, currentStock, minStock

## Langkah Migrasi:

### 1. Setup Supabase Client

- [x] Install @supabase/supabase-js
- [x] Buat konfigurasi Supabase
- [x] Update environment variables

### 2. Buat Schema Database

- [x] Buat SQL schema untuk semua tabel
- [x] Setup Row Level Security (RLS)
- [x] Buat policies untuk autentikasi

### 3. Update Services

- [x] Update auth.service.ts
- [x] Update user.service.ts
- [x] Update produk.service.ts
- [x] Update penjualan.service.ts
- [x] Update pembelian.service.ts
- [x] Update pelanggan.service.ts
- [x] Update supplyer.service.ts
- [x] Update supplierProduk.service.ts
- [x] Update dashboard.service.ts

### 4. Update Types

- [x] Update type definitions untuk kompatibilitas Supabase
- [x] Update Firebase Timestamp ke Supabase timestamp

### 5. Migrasi Data

- [ ] Buat script migrasi data dari Firebase ke Supabase
- [ ] Test migrasi data

### 6. Testing & Cleanup

- [ ] Test semua fungsi CRUD
- [ ] Update komponen yang menggunakan Firebase
- [ ] Remove Firebase dependencies
- [ ] Update dokumentasi

## Dependencies yang Perlu Ditambahkan:

- @supabase/supabase-js
- @supabase/auth-helpers-nextjs (opsional)

## Environment Variables yang Perlu:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (untuk admin operations)