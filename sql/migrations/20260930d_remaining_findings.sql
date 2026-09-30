-- =====================================================================
-- Migrasi: sisa temuan (A3/F-21, A4 refund, F-13, F-18, F-25, fungsi dashboard)
-- Tanggal : 2026-09-30 (dijalankan SETELAH 20260930c_atomic_transactions.sql)
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Isi:
--  1. Data: penjualan berstatus 'Lunas' yang total_dibayar-nya 0/kurang
--     disetel = tagihan (form lama tidak pernah mengisi total_dibayar,
--     sehingga halaman Piutang menampilkannya sebagai Belum Lunas).
--  2. riwayat_pembayaran.tipe ('pembayaran' | 'refund') untuk mencatat
--     pengembalian dana saat penjualan yang sudah dibayar dibatalkan (A4).
--  3. cancel_penjualan: catat refund otomatis bila ada pembayaran (A4).
--  4. create_penjualan: nomor dokumen SELALU dibuat server saat simpan (F-13),
--     status Lunas => total_dibayar = tagihan.
--  5. Fungsi dashboard: hanya admin, pakai total_akhir & kolom tanggal (F-18).
--  6. Kode supplier dari sequence: generate_supplier_code() (F-25).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Perbaiki total_dibayar penjualan Lunas
-- ---------------------------------------------------------------------
UPDATE public.penjualan
   SET total_dibayar = COALESCE(total_akhir, total)
 WHERE status = 'Lunas'
   AND COALESCE(total_dibayar, 0) < COALESCE(total_akhir, total);

-- ---------------------------------------------------------------------
-- 2. Tipe riwayat pembayaran
-- ---------------------------------------------------------------------
ALTER TABLE public.riwayat_pembayaran
  ADD COLUMN IF NOT EXISTS tipe TEXT NOT NULL DEFAULT 'pembayaran';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'riwayat_pembayaran_tipe_check'
       AND conrelid = 'public.riwayat_pembayaran'::regclass
  ) THEN
    ALTER TABLE public.riwayat_pembayaran
      ADD CONSTRAINT riwayat_pembayaran_tipe_check CHECK (tipe IN ('pembayaran', 'refund'));
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. cancel_penjualan + refund
-- ---------------------------------------------------------------------
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
  v_dibayar NUMERIC(14,2);
  v_pelanggan TEXT;
  d RECORD;
BEGIN
  IF v_uid IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'User tidak terautentikasi' USING ERRCODE = '42501';
  END IF;

  SELECT p.status, p.created_by, COALESCE(p.total_dibayar, 0), pl.nama_pelanggan
    INTO v_status, v_created_by, v_dibayar, v_pelanggan
    FROM penjualan p
    LEFT JOIN pelanggan pl ON pl.id = p.pelanggan_id
   WHERE p.id = p_penjualan_id
   FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Penjualan tidak ditemukan';
  END IF;

  IF NOT v_is_admin AND v_created_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Tidak diizinkan membatalkan penjualan ini' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'Batal' THEN
    RETURN 'Batal';
  END IF;

  FOR d IN
    SELECT supplier_produk_id, SUM(qty) AS qty
      FROM penjualan_detail
     WHERE penjualan_id = p_penjualan_id
     GROUP BY supplier_produk_id
  LOOP
    UPDATE supplier_produk SET stok = stok + d.qty WHERE id = d.supplier_produk_id;
  END LOOP;

  -- A4: uang yang sudah diterima dicatat sebagai refund.
  IF v_dibayar > 0 THEN
    INSERT INTO riwayat_pembayaran (penjualan_id, tanggal, jumlah, metode_pembayaran, atas_nama, tipe)
    VALUES (
      p_penjualan_id,
      (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE,
      v_dibayar,
      'Refund',
      COALESCE(NULLIF(v_pelanggan, ''), 'Pelanggan'),
      'refund'
    );
  END IF;

  UPDATE penjualan SET status = 'Batal', total_dibayar = 0 WHERE id = p_penjualan_id;
  UPDATE delivery_orders SET status = 'Batal' WHERE penjualan_id = p_penjualan_id;

  RETURN 'Batal';
END;
$$;

-- ---------------------------------------------------------------------
-- 4. create_penjualan: nomor dari server, Lunas => dibayar penuh
-- ---------------------------------------------------------------------
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
  v_no_invoice TEXT;
  v_no_npb TEXT;
  v_no_do TEXT;
  v_no_tt TEXT;
  v_attempt INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentikasi' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Tidak diizinkan membuat penjualan' USING ERRCODE = '42501';
  END IF;

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

  -- F-13: nomor dokumen selalu dibuat di sini (saat simpan), bukan di form.
  LOOP
    v_no_invoice := public.generate_invoice_number();
    v_no_npb := public.generate_npb_number();
    v_no_tt := public.generate_tanda_terima_number();
    v_no_do := CASE WHEN v_metode_pengambilan = 'Diantar'
                    THEN public.generate_do_number() END;
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
        v_metode_pengambilan, 0, 0, v_status,
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
    END;
  END LOOP;

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

  v_diskon := LEAST(GREATEST(COALESCE(NULLIF(p_data ->> 'diskon', '')::NUMERIC, 0), 0), v_total);
  IF v_pajak_enabled THEN
    v_pajak := ROUND((v_total - v_diskon) * 0.11, 2);
  END IF;
  v_total_akhir := v_total - v_diskon + v_pajak;

  -- Lunas = dibayar penuh; Belum Lunas = uang muka (maks. di bawah tagihan).
  IF v_status = 'Lunas' OR v_total_dibayar >= v_total_akhir THEN
    v_status := 'Lunas';
    v_total_dibayar := v_total_akhir;
  END IF;

  UPDATE penjualan
     SET total = v_total, diskon = v_diskon, pajak = v_pajak,
         total_akhir = v_total_akhir, total_dibayar = v_total_dibayar, status = v_status
   WHERE id = v_penjualan_id;

  IF v_metode_pengambilan = 'Diantar' THEN
    INSERT INTO delivery_orders (penjualan_id, no_do, no_tanda_terima, status, tanggal_kirim)
    VALUES (v_penjualan_id, v_no_do, v_no_tt, 'Draft', (p_data ->> 'tanggal')::DATE);
  END IF;

  RETURN v_penjualan_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Fungsi dashboard: admin saja, definisi sama dengan halaman laporan
-- ---------------------------------------------------------------------
-- Parameter tetap TIMESTAMPTZ (kompatibel dengan client); dikonversi ke
-- tanggal WIB lalu dibandingkan dengan kolom tanggal transaksi.
CREATE OR REPLACE FUNCTION public.sum_penjualan_total(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(SUM(COALESCE(total_akhir, total)), 0)
      FROM penjualan
     WHERE status <> 'Batal'
       AND (p_start IS NULL OR tanggal >= (p_start AT TIME ZONE 'Asia/Jakarta')::DATE)
       AND (p_end IS NULL OR tanggal <= (p_end AT TIME ZONE 'Asia/Jakarta')::DATE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sum_pembelian_total(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(SUM(total), 0)
      FROM pembelian
     WHERE status <> 'Decline'
       AND (p_start IS NULL OR tanggal >= (p_start AT TIME ZONE 'Asia/Jakarta')::DATE)
       AND (p_end IS NULL OR tanggal <= (p_end AT TIME ZONE 'Asia/Jakarta')::DATE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.piutang_summary(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE(count BIGINT, total NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT COUNT(*)::BIGINT,
           COALESCE(SUM(COALESCE(p.total_akhir, p.total) - COALESCE(p.total_dibayar, 0)), 0)
      FROM penjualan p
     WHERE p.status <> 'Batal'
       AND COALESCE(p.total_akhir, p.total) - COALESCE(p.total_dibayar, 0) > 0
       AND (p_start IS NULL OR p.tanggal >= (p_start AT TIME ZONE 'Asia/Jakarta')::DATE)
       AND (p_end IS NULL OR p.tanggal <= (p_end AT TIME ZONE 'Asia/Jakarta')::DATE);
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Kode supplier dari sequence (F-25)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.supplier_kode_seq START 1;

DO $$
DECLARE
  v_max BIGINT;
  v_used BIGINT;
BEGIN
  SELECT MAX(SPLIT_PART(kode, '-', 2)::BIGINT) INTO v_max
    FROM suppliers
   WHERE kode ~ '^SUP-[0-9]+$';
  SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END
    INTO v_used FROM public.supplier_kode_seq;
  IF GREATEST(COALESCE(v_max, 0), v_used) > 0 THEN
    PERFORM setval('public.supplier_kode_seq', GREATEST(COALESCE(v_max, 0), v_used), true);
  END IF;
END;
$$;

-- Padding angka tanpa memotong. LPAD() MEMOTONG teks yang lebih panjang dari
-- target: LPAD('1000', 3, '0') = '100', LPAD('10000', 4, '0') = '1000'.
CREATE OR REPLACE FUNCTION public.pad_number(p_value BIGINT, p_width INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LPAD(p_value::TEXT, GREATEST(p_width, LENGTH(p_value::TEXT)), '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  RETURN 'SUP-' || public.pad_number(nextval('supplier_kode_seq'), 3);
END;
$$;

-- Fungsi nomor dokumen yang sama bug-nya: nomor ke-10000 terpotong jadi
-- "1000" dan bentrok. Didefinisikan ulang memakai pad_number().
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'INV/S32/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY/MM') || '/'
    || public.pad_number(nextval('invoice_seq'), 4);
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
    || public.pad_number(nextval('npb_seq'), 4);
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
    || public.pad_number(nextval('do_seq'), 4);
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
    || public.pad_number(nextval('tanda_terima_seq'), 4);
END;
$$;

-- F-13: nomor dokumen kini hanya dibuat di dalam create_penjualan, sehingga
-- tidak perlu (dan tidak boleh) dipanggil langsung dari browser — memanggilnya
-- hanya "membakar" nomor urut.
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_npb_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_do_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tanda_terima_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_npb_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_do_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tanda_terima_number() TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_supplier_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_supplier_code() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sum_penjualan_total(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sum_pembelian_total(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.piutang_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sum_penjualan_total(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sum_pembelian_total(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.piutang_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

COMMIT;
