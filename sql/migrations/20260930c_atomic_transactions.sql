-- =====================================================================
-- Migrasi: transaksi atomik & pembatasan tulis staff (F-04, F-07, F-20, F-22)
-- Tanggal : 2026-09-30 (dijalankan SETELAH 20260930b_fix_high_priority_data.sql)
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Isi:
--  1. cancel_penjualan(id)        : batal penjualan + kembalikan stok + DO Batal,
--                                   idempoten (tidak bisa mengembalikan stok 2x). F-22
--  2. add_penjualan_payment(...)  : bayar piutang dengan kunci baris, validasi
--                                   sisa, tolak penjualan Batal. F-20
--  3. create_pembelian(p_data)    : header + detail pembelian dalam satu transaksi. F-04
--  4. RLS: staff tidak lagi boleh INSERT/UPDATE/DELETE langsung pada penjualan,
--     penjualan_detail, riwayat_pembayaran, delivery_orders. Staff menulis
--     hanya lewat RPC (create_penjualan, cancel_penjualan). F-07
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. cancel_penjualan
-- ---------------------------------------------------------------------
-- Admin: semua penjualan. Staff: hanya penjualan miliknya (created_by).
-- Status dikunci & dicek di dalam transaksi, sehingga dua request bersamaan
-- tidak mengembalikan stok dua kali. Mengembalikan status akhir.
CREATE OR REPLACE FUNCTION public.cancel_penjualan(p_penjualan_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := public.is_admin() OR public.is_service_role();
  v_status TEXT;
  v_created_by UUID;
  d RECORD;
BEGIN
  IF v_uid IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'User tidak terautentikasi' USING ERRCODE = '42501';
  END IF;

  SELECT status, created_by INTO v_status, v_created_by
    FROM penjualan WHERE id = p_penjualan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Penjualan tidak ditemukan';
  END IF;

  IF NOT v_is_admin AND v_created_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Tidak diizinkan membatalkan penjualan ini' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'Batal' THEN
    RETURN 'Batal'; -- sudah batal: tidak ada yang diubah
  END IF;

  FOR d IN
    SELECT supplier_produk_id, SUM(qty) AS qty
      FROM penjualan_detail
     WHERE penjualan_id = p_penjualan_id
     GROUP BY supplier_produk_id
  LOOP
    UPDATE supplier_produk SET stok = stok + d.qty WHERE id = d.supplier_produk_id;
  END LOOP;

  UPDATE penjualan SET status = 'Batal' WHERE id = p_penjualan_id;
  UPDATE delivery_orders SET status = 'Batal' WHERE penjualan_id = p_penjualan_id;

  RETURN 'Batal';
END;
$$;

-- ---------------------------------------------------------------------
-- 2. add_penjualan_payment (pembayaran piutang) — admin
-- ---------------------------------------------------------------------
-- Mengembalikan status penjualan setelah pembayaran ('Lunas'/'Belum Lunas').
CREATE OR REPLACE FUNCTION public.add_penjualan_payment(
  p_penjualan_id UUID,
  p_tanggal DATE,
  p_jumlah NUMERIC,
  p_metode_pembayaran TEXT,
  p_atas_nama TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_tagihan NUMERIC(14,2);
  v_dibayar NUMERIC(14,2);
  v_sisa NUMERIC(14,2);
  v_new_status TEXT;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan mencatat pembayaran' USING ERRCODE = '42501';
  END IF;
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah bayar harus lebih dari 0';
  END IF;
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal pembayaran wajib diisi';
  END IF;
  IF NULLIF(TRIM(p_metode_pembayaran), '') IS NULL OR NULLIF(TRIM(p_atas_nama), '') IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran dan atas nama wajib diisi';
  END IF;

  SELECT status, COALESCE(total_akhir, total, 0), COALESCE(total_dibayar, 0)
    INTO v_status, v_tagihan, v_dibayar
    FROM penjualan WHERE id = p_penjualan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi penjualan tidak ditemukan';
  END IF;
  IF v_status = 'Batal' THEN
    RAISE EXCEPTION 'Penjualan sudah dibatalkan, tidak bisa menerima pembayaran';
  END IF;

  v_sisa := v_tagihan - v_dibayar;
  IF v_sisa <= 0 THEN
    RAISE EXCEPTION 'Penjualan ini sudah lunas';
  END IF;
  IF ROUND(p_jumlah, 2) > v_sisa THEN
    RAISE EXCEPTION 'Jumlah bayar melebihi sisa utang (sisa: %)', v_sisa;
  END IF;

  INSERT INTO riwayat_pembayaran (penjualan_id, tanggal, jumlah, metode_pembayaran, atas_nama)
  VALUES (p_penjualan_id, p_tanggal, ROUND(p_jumlah, 2), TRIM(p_metode_pembayaran), TRIM(p_atas_nama));

  v_dibayar := v_dibayar + ROUND(p_jumlah, 2);
  v_new_status := CASE WHEN v_dibayar >= v_tagihan THEN 'Lunas' ELSE 'Belum Lunas' END;

  UPDATE penjualan
     SET total_dibayar = v_dibayar, status = v_new_status
   WHERE id = p_penjualan_id;

  RETURN v_new_status;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. create_pembelian — admin
-- ---------------------------------------------------------------------
-- p_data: supplier_id, tanggal, no_do, no_npb, invoice, metode_pembayaran
--         ('Tunai'|'Transfer'), nama_bank, nama_pemilik_rekening, nomor_rekening,
--         status ('Pending' default | 'Completed'),
--         items: [{ supplier_produk_id, qty, harga }]
-- subtotal & total dihitung ulang di server (qty x harga).
-- Status 'Completed' langsung menambah stok lewat receive_pembelian.
CREATE OR REPLACE FUNCTION public.create_pembelian(p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_item JSONB;
  v_qty INTEGER;
  v_harga NUMERIC(14,2);
  v_total NUMERIC(14,2) := 0;
  v_metode TEXT := p_data ->> 'metode_pembayaran';
  v_status TEXT := COALESCE(NULLIF(p_data ->> 'status', ''), 'Pending');
  v_supplier_id UUID := NULLIF(p_data ->> 'supplier_id', '')::UUID;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan membuat pembelian' USING ERRCODE = '42501';
  END IF;
  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier wajib dipilih';
  END IF;
  IF NULLIF(p_data ->> 'tanggal', '') IS NULL THEN
    RAISE EXCEPTION 'Tanggal wajib diisi';
  END IF;
  IF v_metode NOT IN ('Tunai', 'Transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;
  IF v_metode = 'Transfer' AND (
       NULLIF(p_data ->> 'nama_bank', '') IS NULL
    OR NULLIF(p_data ->> 'nama_pemilik_rekening', '') IS NULL
    OR NULLIF(p_data ->> 'nomor_rekening', '') IS NULL) THEN
    RAISE EXCEPTION 'Data transfer belum lengkap.';
  END IF;
  IF v_status NOT IN ('Pending', 'Completed') THEN
    RAISE EXCEPTION 'Status pembelian tidak valid';
  END IF;
  IF jsonb_typeof(p_data -> 'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_data -> 'items') = 0 THEN
    RAISE EXCEPTION 'Minimal satu produk harus dipilih';
  END IF;

  INSERT INTO pembelian (
    supplier_id, tanggal, no_do, no_npb, invoice, metode_pembayaran,
    nama_bank, nama_pemilik_rekening, nomor_rekening, total, status
  ) VALUES (
    v_supplier_id,
    (p_data ->> 'tanggal')::DATE,
    NULLIF(p_data ->> 'no_do', ''),
    NULLIF(p_data ->> 'no_npb', ''),
    NULLIF(p_data ->> 'invoice', ''),
    v_metode,
    NULLIF(p_data ->> 'nama_bank', ''),
    NULLIF(p_data ->> 'nama_pemilik_rekening', ''),
    NULLIF(p_data ->> 'nomor_rekening', ''),
    0,
    'Pending'
  )
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data -> 'items')
  LOOP
    v_qty := (v_item ->> 'qty')::INTEGER;
    v_harga := ROUND((v_item ->> 'harga')::NUMERIC, 2);
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Qty item harus lebih dari 0';
    END IF;
    IF v_harga IS NULL OR v_harga < 0 THEN
      RAISE EXCEPTION 'Harga item tidak valid';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM supplier_produk
       WHERE id = (v_item ->> 'supplier_produk_id')::UUID
         AND supplier_id = v_supplier_id
    ) THEN
      RAISE EXCEPTION 'Produk tidak ditemukan untuk supplier ini';
    END IF;

    INSERT INTO pembelian_detail (pembelian_id, supplier_produk_id, qty, harga, subtotal)
    VALUES (v_id, (v_item ->> 'supplier_produk_id')::UUID, v_qty, v_harga, v_harga * v_qty);

    v_total := v_total + v_harga * v_qty;
  END LOOP;

  UPDATE pembelian SET total = v_total WHERE id = v_id;

  IF v_status = 'Completed' THEN
    PERFORM public.receive_pembelian(v_id);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_penjualan(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_penjualan_payment(UUID, DATE, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_pembelian(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_penjualan(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_penjualan_payment(UUID, DATE, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pembelian(JSONB) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. F-07: staff hanya boleh MEMBACA tabel transaksi penjualan
-- ---------------------------------------------------------------------
-- Semua policy non-SELECT pada tabel di bawah dihapus (nama policy di
-- produksi bisa berbeda dari supabase-schema.sql), lalu dibuat ulang satu
-- policy tulis untuk admin. Policy SELECT (staff baca milik sendiri) tetap.
DO $$
DECLARE
  t TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['penjualan', 'penjualan_detail', 'riwayat_pembayaran', 'delivery_orders']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE 'Policy dihapus: %.%', t, pol.policyname;
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      'Admins manage ' || t, t
    );
  END LOOP;
END;
$$;

COMMIT;
