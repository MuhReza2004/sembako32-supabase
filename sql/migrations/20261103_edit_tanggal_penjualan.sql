-- Jalankan setelah migrasi 20260930d di Supabase SQL Editor.
-- PDF membaca penjualan.tanggal; nomor dokumen tetap sebagai referensi.
BEGIN;
CREATE OR REPLACE FUNCTION public.update_tanggal_penjualan(
  p_penjualan_id UUID,
  p_tanggal DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'Hanya admin yang boleh mengubah tanggal transaksi' USING ERRCODE = '42501';
  END IF;
  IF p_tanggal IS NULL OR NOT isfinite(p_tanggal)
     OR p_tanggal < DATE '0001-01-01' OR p_tanggal > DATE '9999-12-31' THEN
    RAISE EXCEPTION 'Tanggal transaksi tidak valid';
  END IF;
  UPDATE public.penjualan SET tanggal = p_tanggal WHERE id = p_penjualan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Penjualan tidak ditemukan';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_tanggal_penjualan(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_tanggal_penjualan(UUID, DATE) TO authenticated, service_role;
COMMIT;
