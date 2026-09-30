-- =====================================================================
-- Migrasi: perbaikan temuan kritis F-03 (dan pendukung F-01/F-02)
-- Tanggal : 2026-09-30
-- Jalankan di Supabase SQL Editor (sekali). Aman dijalankan ulang.
--
-- Isi:
--  1. increase_stock / decrease_stock: hanya admin atau service_role,
--     qty wajib > 0. Tidak lagi bisa dipanggil staff/anon.
--  2. RPC baru create_penjualan(p_data jsonb): membuat penjualan +
--     detail + pengurangan stok + delivery order dalam SATU transaksi.
--     Harga dan total dihitung ulang di server dari supplier_produk.
--  3. Cabut EXECUTE dari PUBLIC/anon untuk semua RPC SECURITY DEFINER.
--
-- Prasyarat (bagian 0) ikut dibuat bila belum ada di database, karena
-- sebagian isi supabase-schema.sql (sequence & fungsi penomoran) belum
-- pernah diterapkan di produksi.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Prasyarat: helper role, sequence & fungsi penomoran dokumen
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.npb_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.do_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.tanda_terima_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'INV/S32/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY/MM') || '/'
    || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_npb_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'NPB/G001/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY/MM/DD') || '/'
    || LPAD(nextval('npb_seq')::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_do_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'DO/S32/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY/MM') || '/'
    || LPAD(nextval('do_seq')::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_tanda_terima_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'TT/S32/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY/MM') || '/'
    || LPAD(nextval('tanda_terima_seq')::TEXT, 4, '0');
END;
$$;

-- Lanjutkan sequence dari nomor tertinggi yang sudah dipakai (tidak pernah
-- menurunkan sequence). Mengenali format lama (counter per bulan dari client)
-- dan format baru:
--   INV/S32/YYYY/MM/NNNN            (bagian 5)
--   NPB/G001/YYYY/MM/DD/NNNN        (bagian 6)
--   DO/S32/YYYY/MM/NNNN             (bagian 5)
--   TT/S32/YYYY/MM/NNNN (baru, bagian 5) | NNNN/S32/MM/YYYY (lama, bagian 1)
DO $$
DECLARE
  r RECORD;
  v_used BIGINT;
  v_next_max BIGINT;
BEGIN
  FOR r IN
    SELECT 'invoice_seq' AS seq, (
      SELECT MAX(SPLIT_PART(no_invoice, '/', 5)::BIGINT) FROM penjualan
       WHERE no_invoice LIKE 'INV/S32/%' AND SPLIT_PART(no_invoice, '/', 5) ~ '^[0-9]+$'
    ) AS mx
    UNION ALL
    SELECT 'npb_seq', (
      SELECT MAX(SPLIT_PART(no_npb, '/', 6)::BIGINT) FROM penjualan
       WHERE no_npb LIKE 'NPB/%' AND SPLIT_PART(no_npb, '/', 6) ~ '^[0-9]+$'
    )
    UNION ALL
    SELECT 'do_seq', GREATEST(
      (SELECT MAX(SPLIT_PART(no_do, '/', 5)::BIGINT) FROM penjualan
        WHERE no_do LIKE 'DO/S32/%' AND SPLIT_PART(no_do, '/', 5) ~ '^[0-9]+$'),
      (SELECT MAX(SPLIT_PART(no_do, '/', 5)::BIGINT) FROM delivery_orders
        WHERE no_do LIKE 'DO/S32/%' AND SPLIT_PART(no_do, '/', 5) ~ '^[0-9]+$')
    )
    UNION ALL
    SELECT 'tanda_terima_seq', GREATEST(
      (SELECT MAX(SPLIT_PART(no_tanda_terima, '/', 5)::BIGINT) FROM penjualan
        WHERE no_tanda_terima LIKE 'TT/S32/%' AND SPLIT_PART(no_tanda_terima, '/', 5) ~ '^[0-9]+$'),
      (SELECT MAX(SPLIT_PART(no_tanda_terima, '/', 1)::BIGINT) FROM penjualan
        WHERE no_tanda_terima ~ '^[0-9]+/S32/'),
      (SELECT MAX(SPLIT_PART(no_tanda_terima, '/', 5)::BIGINT) FROM delivery_orders
        WHERE no_tanda_terima LIKE 'TT/S32/%' AND SPLIT_PART(no_tanda_terima, '/', 5) ~ '^[0-9]+$'),
      (SELECT MAX(SPLIT_PART(no_tanda_terima, '/', 1)::BIGINT) FROM delivery_orders
        WHERE no_tanda_terima ~ '^[0-9]+/S32/')
    )
  LOOP
    EXECUTE format(
      'SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM public.%I',
      r.seq
    ) INTO v_used;
    v_next_max := GREATEST(COALESCE(r.mx, 0), v_used);
    IF v_next_max > 0 THEN
      PERFORM setval('public.' || r.seq, v_next_max, true);
    END IF;
  END LOOP;
END;
$$;

-- Helper: pemanggil adalah service role (supabaseAdmin di server Next.js)
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- ---------------------------------------------------------------------
-- 1. RPC stok mentah: admin / service role saja
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrease_stock(
  p_supplier_produk_id UUID,
  p_qty INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stok INTEGER;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah stok' USING ERRCODE = '42501';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Qty harus lebih dari 0';
  END IF;

  UPDATE supplier_produk
  SET stok = stok - p_qty
  WHERE id = p_supplier_produk_id AND stok >= p_qty
  RETURNING stok INTO new_stok;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stok tidak mencukupi atau produk tidak ditemukan';
  END IF;

  RETURN new_stok;
END;
$$;

-- Diubah dari LANGUAGE sql ke plpgsql agar bisa memvalidasi pemanggil.
CREATE OR REPLACE FUNCTION public.increase_stock(
  p_supplier_produk_id UUID,
  p_qty INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stok INTEGER;
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah stok' USING ERRCODE = '42501';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Qty harus lebih dari 0';
  END IF;

  UPDATE supplier_produk
  SET stok = stok + p_qty
  WHERE id = p_supplier_produk_id
  RETURNING stok INTO new_stok;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk supplier tidak ditemukan';
  END IF;

  RETURN new_stok;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. create_penjualan: atomik, dipakai admin & staff
-- ---------------------------------------------------------------------
-- p_data (jsonb) mengikuti PenjualanFormData di app/types/penjualan.ts:
--  tanggal, pelanggan_id, catatan, no_invoice, no_npb, no_do, no_tanda_terima,
--  metode_pengambilan, total_dibayar, status, metode_pembayaran, nomor_rekening,
--  nama_bank, nama_pemilik_rekening, tanggal_jatuh_tempo, diskon, pajak_enabled,
--  items: [{ supplier_produk_id, qty, harga_tipe: 'normal'|'grosir' }]
-- Nilai harga/subtotal/total/pajak/total_akhir dari client DIABAIKAN dan
-- dihitung ulang di sini.
CREATE OR REPLACE FUNCTION public.create_penjualan(p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_penjualan_id UUID;
  v_item JSONB;
  v_sp RECORD;
  v_qty INTEGER;
  v_harga NUMERIC(14,2);
  v_total NUMERIC(14,2) := 0;
  v_diskon NUMERIC(14,2);
  v_pajak_enabled BOOLEAN := COALESCE((p_data ->> 'pajak_enabled')::BOOLEAN, false);
  v_pajak NUMERIC(14,2) := 0;
  v_total_akhir NUMERIC(14,2);
  v_total_dibayar NUMERIC(14,2) := COALESCE(NULLIF(p_data ->> 'total_dibayar', '')::NUMERIC, 0);
  v_metode_pengambilan TEXT := p_data ->> 'metode_pengambilan';
  v_status TEXT := p_data ->> 'status';
  v_no_invoice TEXT := NULLIF(p_data ->> 'no_invoice', '');
  v_no_npb TEXT := NULLIF(p_data ->> 'no_npb', '');
  v_no_do TEXT := NULLIF(p_data ->> 'no_do', '');
  v_no_tt TEXT := NULLIF(p_data ->> 'no_tanda_terima', '');
  v_attempt INTEGER := 0;
BEGIN
  -- Otorisasi: harus user login dengan role valid di tabel users
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Tidak diizinkan membuat penjualan' USING ERRCODE = '42501';
  END IF;

  -- Validasi header
  IF NULLIF(p_data ->> 'pelanggan_id', '') IS NULL THEN
    RAISE EXCEPTION 'Pelanggan wajib dipilih';
  END IF;
  IF NULLIF(p_data ->> 'tanggal', '') IS NULL THEN
    RAISE EXCEPTION 'Tanggal wajib diisi';
  END IF;
  IF v_metode_pengambilan NOT IN ('Ambil Langsung', 'Diantar') THEN
    RAISE EXCEPTION 'Metode pengambilan tidak valid';
  END IF;
  IF v_status NOT IN ('Lunas', 'Belum Lunas') THEN
    RAISE EXCEPTION 'Status penjualan tidak valid';
  END IF;
  IF jsonb_typeof(p_data -> 'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_data -> 'items') = 0 THEN
    RAISE EXCEPTION 'Minimal satu produk harus dipilih';
  END IF;
  IF v_total_dibayar < 0 THEN
    RAISE EXCEPTION 'Total dibayar tidak boleh negatif';
  END IF;

  -- Nomor dokumen: pakai yang sudah digenerate form, atau buat baru
  IF v_no_invoice IS NULL THEN v_no_invoice := public.generate_invoice_number(); END IF;
  IF v_no_npb IS NULL THEN v_no_npb := public.generate_npb_number(); END IF;
  IF v_metode_pengambilan = 'Diantar' THEN
    IF v_no_do IS NULL THEN v_no_do := public.generate_do_number(); END IF;
    IF v_no_tt IS NULL THEN v_no_tt := public.generate_tanda_terima_number(); END IF;
  ELSE
    v_no_do := NULL;
  END IF;

  -- Header (total diisi setelah item dihitung). Retry bila nomor bentrok.
  LOOP
    BEGIN
      INSERT INTO penjualan (
        tanggal, pelanggan_id, catatan, no_invoice, no_npb, no_do, no_tanda_terima,
        metode_pengambilan, total, total_dibayar, status, metode_pembayaran,
        nomor_rekening, nama_bank, nama_pemilik_rekening, tanggal_jatuh_tempo,
        diskon, pajak_enabled, pajak, total_akhir, created_by
      ) VALUES (
        (p_data ->> 'tanggal')::DATE,
        (p_data ->> 'pelanggan_id')::UUID,
        NULLIF(p_data ->> 'catatan', ''),
        v_no_invoice, v_no_npb, v_no_do, v_no_tt,
        v_metode_pengambilan, 0, v_total_dibayar, v_status,
        NULLIF(p_data ->> 'metode_pembayaran', ''),
        NULLIF(p_data ->> 'nomor_rekening', ''),
        NULLIF(p_data ->> 'nama_bank', ''),
        NULLIF(p_data ->> 'nama_pemilik_rekening', ''),
        NULLIF(p_data ->> 'tanggal_jatuh_tempo', '')::DATE,
        0, v_pajak_enabled, 0, 0, v_uid
      )
      RETURNING id INTO v_penjualan_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt >= 3 THEN
        RAISE EXCEPTION 'Gagal membuat nomor dokumen unik, silakan coba lagi';
      END IF;
      v_no_invoice := public.generate_invoice_number();
      v_no_npb := public.generate_npb_number();
      IF v_metode_pengambilan = 'Diantar' THEN
        v_no_do := public.generate_do_number();
        v_no_tt := public.generate_tanda_terima_number();
      ELSIF v_no_tt IS NOT NULL THEN
        v_no_tt := public.generate_tanda_terima_number();
      END IF;
    END;
  END LOOP;

  -- Item: kunci baris stok, hitung harga di server, kurangi stok
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data -> 'items')
  LOOP
    v_qty := (v_item ->> 'qty')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Qty item harus lebih dari 0';
    END IF;

    SELECT sp.id, sp.stok, sp.harga_jual, sp.harga_jual_normal, sp.harga_jual_grosir,
           COALESCE(p.nama, 'Produk') AS nama
      INTO v_sp
      FROM supplier_produk sp
      LEFT JOIN produk p ON p.id = sp.produk_id
     WHERE sp.id = (v_item ->> 'supplier_produk_id')::UUID
     FOR UPDATE OF sp;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak ditemukan';
    END IF;
    IF v_sp.stok < v_qty THEN
      RAISE EXCEPTION 'Stok % tidak mencukupi (sisa: %)', v_sp.nama, v_sp.stok;
    END IF;

    IF COALESCE(v_item ->> 'harga_tipe', 'normal') = 'grosir' THEN
      v_harga := COALESCE(v_sp.harga_jual_grosir, v_sp.harga_jual, 0);
    ELSE
      v_harga := COALESCE(v_sp.harga_jual_normal, v_sp.harga_jual, 0);
    END IF;

    UPDATE supplier_produk SET stok = stok - v_qty WHERE id = v_sp.id;

    INSERT INTO penjualan_detail (penjualan_id, supplier_produk_id, qty, harga, subtotal)
    VALUES (v_penjualan_id, v_sp.id, v_qty, v_harga, v_harga * v_qty);

    v_total := v_total + v_harga * v_qty;
  END LOOP;

  -- Total (rumus sama dengan PenjualanForm): pajak 11% dari (subtotal - diskon)
  v_diskon := LEAST(GREATEST(COALESCE(NULLIF(p_data ->> 'diskon', '')::NUMERIC, 0), 0), v_total);
  IF v_pajak_enabled THEN
    v_pajak := ROUND((v_total - v_diskon) * 0.11, 2);
  END IF;
  v_total_akhir := v_total - v_diskon + v_pajak;

  UPDATE penjualan
     SET total = v_total, diskon = v_diskon, pajak = v_pajak, total_akhir = v_total_akhir
   WHERE id = v_penjualan_id;

  IF v_metode_pengambilan = 'Diantar' THEN
    INSERT INTO delivery_orders (penjualan_id, no_do, no_tanda_terima, status, tanggal_kirim)
    VALUES (v_penjualan_id, v_no_do, v_no_tt, 'Draft', (p_data ->> 'tanggal')::DATE);
  END IF;

  RETURN v_penjualan_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Hak eksekusi. Default Postgres memberi EXECUTE ke PUBLIC (termasuk anon).
-- ---------------------------------------------------------------------
-- Dijalankan hanya untuk fungsi yang memang ada (skema produksi bisa
-- berbeda dari supabase-schema.sql, mis. fungsi dashboard belum dibuat).
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.increase_stock(uuid, integer)',
    'public.decrease_stock(uuid, integer)',
    'public.create_penjualan(jsonb)',
    'public.generate_invoice_number()',
    'public.generate_npb_number()',
    'public.generate_do_number()',
    'public.generate_tanda_terima_number()',
    'public.sum_penjualan_total(timestamptz, timestamptz)',
    'public.sum_pembelian_total(timestamptz, timestamptz)',
    'public.piutang_summary(timestamptz, timestamptz)'
  ]
  LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    ELSE
      RAISE NOTICE 'Lewati % (fungsi tidak ada di database ini)', f;
    END IF;
  END LOOP;
END;
$$;

-- increase/decrease di-grant ke authenticated, tetapi fungsi sendiri menolak
-- pemanggil yang bukan admin/service role.
GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

COMMIT;
