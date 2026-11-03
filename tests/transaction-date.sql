-- Run only in a disposable empty PostgreSQL database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$
  SELECT current_setting('test.is_admin', true) = 'true';
$$;
CREATE FUNCTION public.is_service_role() RETURNS boolean LANGUAGE sql AS $$ SELECT false; $$;
CREATE TABLE public.penjualan (id uuid PRIMARY KEY, tanggal date, no_invoice text);
INSERT INTO public.penjualan VALUES ('00000000-0000-0000-0000-000000000001', '2026-11-03', 'INV/original');

\ir ../sql/migrations/20261103_edit_tanggal_penjualan.sql
SET ROLE authenticated;
SET test.is_admin = 'true';
SELECT public.update_tanggal_penjualan('00000000-0000-0000-0000-000000000001', '2024-02-29');
DO $$ BEGIN
  BEGIN
    PERFORM public.update_tanggal_penjualan('00000000-0000-0000-0000-000000000001', NULL);
    RAISE EXCEPTION 'FAIL null accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Tanggal transaksi tidak valid' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_tanggal_penjualan('00000000-0000-0000-0000-000000000099', '2024-02-29');
    RAISE EXCEPTION 'FAIL missing ID accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Penjualan tidak ditemukan' THEN RAISE; END IF;
  END;
END $$;
SET test.is_admin = 'false';
DO $$ BEGIN
  BEGIN
    PERFORM public.update_tanggal_penjualan('00000000-0000-0000-0000-000000000001', '2026-11-03');
    RAISE EXCEPTION 'FAIL staff accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT tanggal = '2024-02-29' AND no_invoice = 'INV/original' FROM penjualan);
  ASSERT NOT has_function_privilege('anon', 'public.update_tanggal_penjualan(uuid,date)', 'EXECUTE');
END $$;
