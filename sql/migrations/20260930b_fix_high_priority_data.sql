-- =====================================================================
-- Migrasi: perbaikan temuan prioritas tinggi F-05, F-06, F-19
-- Tanggal : 2026-09-30 (dijalankan SETELAH 20260930_fix_critical_security.sql)
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Isi:
--  1. F-19  Kolom uang DECIMAL(10,2) -> DECIMAL(14,2) (maks Rp99 juta -> Rp999 miliar).
--  2. F-06  FK transaksi ON DELETE CASCADE -> RESTRICT, agar menghapus
--           pelanggan/supplier/produk/harga produk tidak menghapus histori.
--  3. F-05  RPC receive_pembelian & decline_pembelian: atomik, hanya admin,
--           status dikunci (pembelian Completed tidak bisa diterima ulang).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. F-19: presisi kolom uang (menaikkan presisi tidak mengubah data)
-- ---------------------------------------------------------------------
ALTER TABLE public.penjualan_detail
  ALTER COLUMN harga TYPE DECIMAL(14,2),
  ALTER COLUMN subtotal TYPE DECIMAL(14,2);

ALTER TABLE public.riwayat_pembayaran
  ALTER COLUMN jumlah TYPE DECIMAL(14,2);

ALTER TABLE public.supplier_produk
  ALTER COLUMN harga_beli TYPE DECIMAL(14,2),
  ALTER COLUMN harga_jual TYPE DECIMAL(14,2),
  ALTER COLUMN harga_jual_normal TYPE DECIMAL(14,2),
  ALTER COLUMN harga_jual_grosir TYPE DECIMAL(14,2);

-- ---------------------------------------------------------------------
-- 2. F-06: FK transaksi -> ON DELETE RESTRICT
-- ---------------------------------------------------------------------
-- Nama constraint dicari dari katalog (bisa berbeda antar database).
-- supplier_produk.supplier_id/produk_id tetap CASCADE: harga produk yang
-- belum pernah dipakai transaksi ikut terhapus bersama supplier/produknya,
-- sedangkan yang sudah dipakai akan tertahan oleh RESTRICT di detail.
DO $$
DECLARE
  r RECORD;
  v_con TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('penjualan',        'pelanggan_id',       'pelanggan'),
      ('pembelian',        'supplier_id',        'suppliers'),
      ('penjualan_detail', 'supplier_produk_id', 'supplier_produk'),
      ('pembelian_detail', 'supplier_produk_id', 'supplier_produk')
    ) AS t(tbl, col, ref_tbl)
  LOOP
    FOR v_con IN
      SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.contype = 'f'
         AND c.conrelid = format('public.%I', r.tbl)::regclass
         AND c.confrelid = format('public.%I', r.ref_tbl)::regclass
         AND a.attname = r.col
         AND array_length(c.conkey, 1) = 1
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, v_con);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE RESTRICT',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col, r.ref_tbl
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. F-05: terima / tolak pembelian secara atomik
-- ---------------------------------------------------------------------
-- Terima barang: Pending -> Completed, stok bertambah, harga_beli diperbarui.
-- Pembelian yang bukan Pending ditolak (mencegah stok bertambah dua kali).
CREATE OR REPLACE FUNCTION public.receive_pembelian(
  p_pembelian_id UUID,
  p_no_do TEXT DEFAULT NULL,
  p_no_npb TEXT DEFAULT NULL,
  p_invoice TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  d RECORD;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan menerima pembelian' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan';
  END IF;
  IF v_status <> 'Pending' THEN
    RAISE EXCEPTION 'Pembelian berstatus % tidak bisa diterima lagi', v_status;
  END IF;

  UPDATE pembelian
     SET status = 'Completed',
         no_do = COALESCE(NULLIF(p_no_do, ''), no_do),
         no_npb = COALESCE(NULLIF(p_no_npb, ''), no_npb),
         invoice = COALESCE(NULLIF(p_invoice, ''), invoice)
   WHERE id = p_pembelian_id;

  FOR d IN
    SELECT supplier_produk_id, SUM(qty) AS qty,
           (ARRAY_AGG(harga ORDER BY created_at DESC))[1] AS harga
      FROM pembelian_detail
     WHERE pembelian_id = p_pembelian_id
     GROUP BY supplier_produk_id
  LOOP
    IF d.qty <= 0 THEN
      RAISE EXCEPTION 'Qty pembelian tidak valid';
    END IF;
    UPDATE supplier_produk
       SET stok = stok + d.qty,
           harga_beli = COALESCE(d.harga, harga_beli)
     WHERE id = d.supplier_produk_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk supplier pada pembelian tidak ditemukan';
    END IF;
  END LOOP;
END;
$$;

-- Tolak pembelian: Pending -> Decline (tanpa ubah stok);
-- Completed -> Decline (stok dikurangi kembali, gagal bila stok sudah terpakai).
CREATE OR REPLACE FUNCTION public.decline_pembelian(p_pembelian_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  d RECORD;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan menolak pembelian' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan';
  END IF;
  IF v_status = 'Decline' THEN
    RETURN; -- sudah ditolak, tidak ada yang diubah
  END IF;

  IF v_status = 'Completed' THEN
    FOR d IN
      SELECT pd.supplier_produk_id, SUM(pd.qty) AS qty, COALESCE(MAX(p.nama), 'Produk') AS nama
        FROM pembelian_detail pd
        JOIN supplier_produk sp ON sp.id = pd.supplier_produk_id
        LEFT JOIN produk p ON p.id = sp.produk_id
       WHERE pd.pembelian_id = p_pembelian_id
       GROUP BY pd.supplier_produk_id
    LOOP
      UPDATE supplier_produk
         SET stok = stok - d.qty
       WHERE id = d.supplier_produk_id AND stok >= d.qty;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stok % sudah terpakai, pembelian tidak bisa ditolak', d.nama;
      END IF;
    END LOOP;
  END IF;

  UPDATE pembelian SET status = 'Decline' WHERE id = p_pembelian_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.receive_pembelian(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_pembelian(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_pembelian(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_pembelian(UUID) TO authenticated, service_role;

COMMIT;
