import { supabase } from "@/app/lib/supabase";
import { todayWIB } from "@/helper/format";
import {
  Penjualan,
  PenjualanDetail,
  PenjualanFormData,
} from "@/app/types/penjualan";

type PenjualanDetailRow = PenjualanDetail & {
  supplier_produk?: {
    harga_jual?: number;
    harga_jual_normal?: number;
    harga_jual_grosir?: number;
    produk?: { nama?: string; satuan?: string };
  };
};

type PenjualanRow = Penjualan & {
  pelanggan?: {
    nama_pelanggan?: string;
    alamat?: string;
    nama_toko?: string;
    no_telp?: string;
  } | null;
};

const DECIMAL_14_2_MAX = 999999999999.99;

const assertValidMoney = (label: string, value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} tidak valid`);
  }
  if (value > DECIMAL_14_2_MAX) {
    throw new Error(
      `${label} terlalu besar. Maksimal 999.999.999.999,99. Mohon pecah transaksi atau tingkatkan presisi kolom di database.`,
    );
  }
  if (value < 0) {
    throw new Error(`${label} tidak boleh negatif`);
  }
};

// --- existing createPenjualan function ---
export const createPenjualan = async (data: PenjualanFormData) => {
  assertValidMoney("Total penjualan", Number(data.total));
  assertValidMoney("Total dibayar", Number(data.total_dibayar || 0));
  assertValidMoney("Diskon", Number(data.diskon || 0));
  assertValidMoney("Pajak", Number(data.pajak || 0));
  assertValidMoney("Total akhir", Number(data.total_akhir || 0));

  for (const item of data.items || []) {
    assertValidMoney("Harga item", Number(item.harga));
    assertValidMoney("Subtotal item", Number(item.subtotal));
  }

  // Header, detail, pengurangan stok, dan delivery order dibuat dalam satu
  // transaksi DB oleh RPC create_penjualan. Harga, total, dan nomor dokumen
  // dibuat di server (sql/migrations/20260930d_remaining_findings.sql).
  const payload = {
    tanggal: data.tanggal,
    pelanggan_id: data.pelanggan_id,
    catatan: data.catatan,
    metode_pengambilan: data.metode_pengambilan,
    total_dibayar: Number(data.total_dibayar || 0),
    status: data.status,
    metode_pembayaran: data.metode_pembayaran,
    nomor_rekening: data.nomor_rekening,
    nama_bank: data.nama_bank,
    nama_pemilik_rekening: data.nama_pemilik_rekening,
    tanggal_jatuh_tempo: data.tanggal_jatuh_tempo || null,
    diskon: Number(data.diskon || 0),
    pajak_enabled: data.pajak_enabled || false,
    items: (data.items || []).map((item) => ({
      supplier_produk_id: item.supplier_produk_id,
      qty: Number(item.qty),
      harga_tipe: item.harga_tipe || "normal",
    })),
  };

  const { data: penjualanId, error } = await supabase.rpc("create_penjualan", {
    p_data: payload,
  });

  if (error) {
    console.error("Error creating penjualan:", error);
    throw new Error(error.message || "Gagal menyimpan penjualan");
  }

  return penjualanId as string;
};

export const getPenjualanPage = async (params: {
  page: number;
  perPage: number;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{ data: Penjualan[]; count: number }> => {
  const { page, perPage, searchTerm, startDate, endDate, status } = params;
  const from = page * perPage;
  const to = from + perPage - 1;
  const term = searchTerm?.trim() ?? "";

  let query = supabase
    .from("penjualan")
    .select(
      `
      id,
      tanggal,
      pelanggan_id,
      no_invoice,
      no_npb,
      no_do,
      metode_pengambilan,
      total,
      total_akhir,
      total_dibayar,
      status,
      created_at,
      updated_at,
      created_by,
      pelanggan (
        id,
        nama_pelanggan,
        alamat,
        nama_toko,
        no_telp
      )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (startDate) {
    query = query.gte("tanggal", startDate);
  }
  if (endDate) {
    query = query.lte("tanggal", endDate);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (term) {
    const orParts: string[] = [
      `no_invoice.ilike.%${term}%`,
      `status.ilike.%${term}%`,
    ];
    const { data: pelangganRows } = await supabase
      .from("pelanggan")
      .select("id")
      .ilike("nama_pelanggan", `%${term}%`);
    const pelangganIds =
      (pelangganRows || [])
        .map((row) => row?.id as string | undefined)
        .filter((id): id is string => !!id) || [];
    if (pelangganIds.length > 0) {
      orParts.push(`pelanggan_id.in.(${pelangganIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("Error fetching penjualan page:", error);
    throw error;
  }

  const rows = (data as PenjualanRow[]) || [];
  const createdByIds = Array.from(
    new Set(
      rows.map((item) => item.created_by).filter((id): id is string => !!id),
    ),
  );

  let usersMap = new Map<string, { email?: string; role?: string }>();
  if (createdByIds.length > 0) {
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, email, role")
      .in("id", createdByIds);

    if (usersError) {
      console.error("Error fetching users:", usersError);
    } else {
      usersMap = new Map(
        (usersData || []).map((u) => [
          u.id as string,
          { email: u.email as string, role: u.role as string },
        ]),
      );
    }
  }

  const mappedData = rows.map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    pelanggan_id: item.pelanggan_id,
    catatan: item.catatan,
    no_invoice: item.no_invoice,
    no_npb: item.no_npb,
    no_do: item.no_do,
    no_tanda_terima: item.no_tanda_terima,
    metode_pengambilan: item.metode_pengambilan,
    total: item.total,
    total_dibayar: item.total_dibayar,
    status: item.status,
    metode_pembayaran: item.metode_pembayaran,
    nomor_rekening: item.nomor_rekening,
    nama_bank: item.nama_bank,
    nama_pemilik_rekening: item.nama_pemilik_rekening,
    tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
    diskon: item.diskon,
    pajak_enabled: item.pajak_enabled,
    pajak: item.pajak,
    total_akhir: item.total_akhir,
    created_at: item.created_at,
    updated_at: item.updated_at,
    created_by: item.created_by,
    createdByEmail: usersMap.get(item.created_by || "")?.email,
    createdByRole: usersMap.get(item.created_by || "")?.role,
    namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: item.pelanggan?.alamat || "",
    nama_toko: item.pelanggan?.nama_toko || "",
    no_telp: item.pelanggan?.no_telp || "",
  }));

  return { data: mappedData, count: count || 0 };
};

export const getPenjualanById = async (
  id: string,
): Promise<Penjualan | null> => {
  const { data, error } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat,
        nama_toko,
        no_telp
      ),
      items:penjualan_detail (
        id,
        penjualan_id,
        supplier_produk_id,
        qty,
        harga,
        subtotal,
        created_at,
        supplier_produk (
          id,
          harga_jual,
          harga_jual_normal,
          harga_jual_grosir,
          produk (
            id,
            nama,
            satuan
          )
        )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching penjualan by id:", error);
    return null;
  }

  let createdByEmail: string | undefined;
  let createdByRole: string | undefined;
  if (data.created_by) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", data.created_by)
      .single();
    if (usersData) {
      createdByEmail = usersData.email as string;
      createdByRole = usersData.role as string;
    }
  }

  const itemRows = (data.items || []) as PenjualanDetailRow[];

  return {
    id: data.id,
    tanggal: data.tanggal,
    pelanggan_id: data.pelanggan_id,
    catatan: data.catatan,
    no_invoice: data.no_invoice,
    no_npb: data.no_npb,
    no_do: data.no_do,
    no_tanda_terima: data.no_tanda_terima,
    metode_pengambilan: data.metode_pengambilan,
    total: data.total,
    total_dibayar: data.total_dibayar,
    status: data.status,
    metode_pembayaran: data.metode_pembayaran,
    nomor_rekening: data.nomor_rekening,
    nama_bank: data.nama_bank,
    nama_pemilik_rekening: data.nama_pemilik_rekening,
    tanggal_jatuh_tempo: data.tanggal_jatuh_tempo,
    diskon: data.diskon,
    pajak_enabled: data.pajak_enabled,
    pajak: data.pajak,
    total_akhir: data.total_akhir,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    createdByEmail,
    createdByRole,
    namaPelanggan: data.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: data.pelanggan?.alamat || "",
    nama_toko: data.pelanggan?.nama_toko || "",
    no_telp: data.pelanggan?.no_telp || "",
    items: itemRows.map((detail) => ({
      id: detail.id,
      penjualan_id: detail.penjualan_id,
      supplier_produk_id: detail.supplier_produk_id,
      qty: detail.qty,
      harga: detail.harga,
      subtotal: detail.subtotal,
      created_at: detail.created_at,
      namaProduk:
        detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
      satuan: detail.supplier_produk?.produk?.satuan || "",
      hargaJual:
        detail.harga ||
        detail.supplier_produk?.harga_jual_normal ||
        detail.supplier_produk?.harga_jual,
    })),
  };
};

export const getPenjualanForCurrentUser = async (): Promise<Penjualan[]> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("User tidak terautentikasi.");
  }

  const { data: penjualanData, error: penjualanError } = await supabase
    .from("penjualan")
    .select(
      `
        id,
        tanggal,
        pelanggan_id,
        no_invoice,
        no_npb,
        no_do,
        no_tanda_terima,
        metode_pengambilan,
        total,
        total_dibayar,
        total_akhir,
        status,
        metode_pembayaran,
        nomor_rekening,
        nama_bank,
        nama_pemilik_rekening,
        tanggal_jatuh_tempo,
        diskon,
        pajak_enabled,
        pajak,
        created_at,
        updated_at,
        created_by,
        pelanggan (
          id,
          nama_pelanggan,
          alamat,
          nama_toko,
          no_telp
        )
      `,
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (penjualanError) {
    console.error("Error fetching penjualan:", penjualanError);
    throw penjualanError;
  }

  const penjualanIds =
    (penjualanData as PenjualanRow[] | null)
      ?.map((item) => item.id)
      .filter((id): id is string => !!id) ?? [];

  let detailsData: unknown[] = [];
  if (penjualanIds.length > 0) {
    const { data, error: detailsError } = await supabase
      .from("penjualan_detail")
      .select(
        `
        id,
        penjualan_id,
        supplier_produk_id,
        qty,
        harga,
        subtotal,
        created_at,
        supplier_produk (
          id,
          harga_jual,
          harga_jual_normal,
          harga_jual_grosir,
          produk (
            id,
            nama,
            satuan
          )
        )
      `,
      )
      .in("penjualan_id", penjualanIds);

    if (detailsError) {
      console.error("Error fetching penjualan_detail:", detailsError);
      throw detailsError;
    }
    detailsData = data || [];
  }

  const mappedData = (penjualanData as PenjualanRow[]).map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    pelanggan_id: item.pelanggan_id,
    catatan: item.catatan,
    no_invoice: item.no_invoice,
    no_npb: item.no_npb,
    no_do: item.no_do,
    no_tanda_terima: item.no_tanda_terima,
    metode_pengambilan: item.metode_pengambilan,
    total: item.total,
    total_dibayar: item.total_dibayar,
    status: item.status,
    metode_pembayaran: item.metode_pembayaran,
    nomor_rekening: item.nomor_rekening,
    nama_bank: item.nama_bank,
    nama_pemilik_rekening: item.nama_pemilik_rekening,
    tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
    diskon: item.diskon,
    pajak_enabled: item.pajak_enabled,
    pajak: item.pajak,
    total_akhir: item.total_akhir,
    created_at: item.created_at,
    updated_at: item.updated_at,
    created_by: item.created_by,
    createdByEmail: user.email || "Anda",
    namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: item.pelanggan?.alamat || "",
    nama_toko: item.pelanggan?.nama_toko || "",
    no_telp: item.pelanggan?.no_telp || "",
    items:
      (detailsData as PenjualanDetailRow[])
        .filter((detail) => detail.penjualan_id === item.id)
        .map((detail) => ({
          id: detail.id,
          penjualan_id: detail.penjualan_id,
          supplier_produk_id: detail.supplier_produk_id,
          qty: detail.qty,
          harga: detail.harga,
          subtotal: detail.subtotal,
          created_at: detail.created_at,
          namaProduk:
            detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
          satuan: detail.supplier_produk?.produk?.satuan || "",
          hargaJual:
            detail.harga ||
            detail.supplier_produk?.harga_jual_normal ||
            detail.supplier_produk?.harga_jual,
        })) || [],
  }));

  return mappedData;
};

export const getPenjualanPageForCurrentUser = async (params: {
  page: number;
  perPage: number;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{ data: Penjualan[]; count: number }> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("User tidak terautentikasi.");
  }

  const { page, perPage, searchTerm, startDate, endDate, status } = params;
  const from = page * perPage;
  const to = from + perPage - 1;
  const term = searchTerm?.trim() ?? "";

  let query = supabase
    .from("penjualan")
    .select(
      `
        id,
        tanggal,
        pelanggan_id,
        no_invoice,
        no_npb,
        no_do,
        no_tanda_terima,
        metode_pengambilan,
        total,
        total_dibayar,
        total_akhir,
        status,
        metode_pembayaran,
        nomor_rekening,
        nama_bank,
        nama_pemilik_rekening,
        tanggal_jatuh_tempo,
        diskon,
        pajak_enabled,
        pajak,
        created_at,
        updated_at,
        created_by,
        pelanggan (
          id,
          nama_pelanggan,
          alamat,
          nama_toko,
          no_telp
        )
        `,
      { count: "exact" },
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (startDate) {
    query = query.gte("tanggal", startDate);
  }
  if (endDate) {
    query = query.lte("tanggal", endDate);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (term) {
    const orParts: string[] = [
      `no_invoice.ilike.%${term}%`,
      `status.ilike.%${term}%`,
    ];
    const { data: pelangganRows } = await supabase
      .from("pelanggan")
      .select("id")
      .ilike("nama_pelanggan", `%${term}%`);
    const pelangganIds =
      (pelangganRows || [])
        .map((row) => row?.id as string | undefined)
        .filter((id): id is string => !!id) || [];
    if (pelangganIds.length > 0) {
      orParts.push(`pelanggan_id.in.(${pelangganIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("Error fetching penjualan page:", error);
    throw error;
  }

  const rows = (data as PenjualanRow[]) || [];
  const penjualanIds = rows
    .map((item) => item.id)
    .filter((id): id is string => !!id);

  let detailsData: unknown[] = [];
  if (penjualanIds.length > 0) {
    const { data: detailRows, error: detailsError } = await supabase
      .from("penjualan_detail")
      .select(
        `
        id,
        penjualan_id,
        supplier_produk_id,
        qty,
        harga,
        subtotal,
        created_at,
        supplier_produk (
          id,
          harga_jual,
          harga_jual_normal,
          harga_jual_grosir,
          produk (
            id,
            nama,
            satuan
          )
        )
      `,
      )
      .in("penjualan_id", penjualanIds);

    if (detailsError) {
      console.error("Error fetching penjualan_detail:", detailsError);
      throw detailsError;
    }
    detailsData = detailRows || [];
  }

  const mappedData = rows.map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    pelanggan_id: item.pelanggan_id,
    catatan: item.catatan,
    no_invoice: item.no_invoice,
    no_npb: item.no_npb,
    no_do: item.no_do,
    no_tanda_terima: item.no_tanda_terima,
    metode_pengambilan: item.metode_pengambilan,
    total: item.total,
    total_dibayar: item.total_dibayar,
    status: item.status,
    metode_pembayaran: item.metode_pembayaran,
    nomor_rekening: item.nomor_rekening,
    nama_bank: item.nama_bank,
    nama_pemilik_rekening: item.nama_pemilik_rekening,
    tanggal_jatuh_tempo: item.tanggal_jatuh_tempo,
    diskon: item.diskon,
    pajak_enabled: item.pajak_enabled,
    pajak: item.pajak,
    total_akhir: item.total_akhir,
    created_at: item.created_at,
    updated_at: item.updated_at,
    created_by: item.created_by,
    createdByEmail: user.email || "Anda",
    namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: item.pelanggan?.alamat || "",
    nama_toko: item.pelanggan?.nama_toko || "",
    no_telp: item.pelanggan?.no_telp || "",
    items:
      (detailsData as PenjualanDetailRow[])
        .filter((detail) => detail.penjualan_id === item.id)
        .map((detail) => ({
          id: detail.id,
          penjualan_id: detail.penjualan_id,
          supplier_produk_id: detail.supplier_produk_id,
          qty: detail.qty,
          harga: detail.harga,
          subtotal: detail.subtotal,
          created_at: detail.created_at,
          namaProduk:
            detail.supplier_produk?.produk?.nama || "Produk Tidak Ditemukan",
          satuan: detail.supplier_produk?.produk?.satuan || "",
          hargaJual:
            detail.harga ||
            detail.supplier_produk?.harga_jual_normal ||
            detail.supplier_produk?.harga_jual,
        })) || [],
  }));

  return { data: mappedData, count: count || 0 };
};

export const getPenjualanSummaryForCurrentUser = async () => {
  const list = await getPenjualanForCurrentUser();
  const todayStr = todayWIB();

  const todayItems = list.filter((p) => p.tanggal === todayStr);
  const totalHariIni = todayItems.reduce(
    (sum, p) => sum + (p.total_akhir ?? p.total ?? 0),
    0,
  );

  const jumlahHariIni = todayItems.length;
  const belumLunas = list.filter((p) => p.status === "Belum Lunas").length;
  const batal = list.filter((p) => p.status === "Batal").length;

  return {
    totalHariIni,
    jumlahHariIni,
    belumLunas,
    batal,
  };
};

// --- addPiutangPayment: atomik di DB (kunci baris, validasi sisa) ---
export const addPiutangPayment = async (
  penjualanId: string,
  payment: {
    tanggal: string;
    jumlah: number;
    metode_pembayaran: string;
    atas_nama: string;
  },
): Promise<void> => {
  assertValidMoney("Jumlah bayar", Number(payment.jumlah));

  const { error } = await supabase.rpc("add_penjualan_payment", {
    p_penjualan_id: penjualanId,
    p_tanggal: payment.tanggal,
    p_jumlah: Number(payment.jumlah),
    p_metode_pembayaran: payment.metode_pembayaran,
    p_atas_nama: payment.atas_nama,
  });

  if (error) {
    console.error("Error adding payment:", error);
    throw new Error(error.message || "Gagal mencatat pembayaran");
  }
};

// --- cancelPenjualan: atomik & idempoten di DB (admin, atau staff pemilik) ---
export const cancelPenjualan = async (id: string) => {
  const { error } = await supabase.rpc("cancel_penjualan", {
    p_penjualan_id: id,
  });

  if (error) {
    console.error("Error cancelling penjualan:", error);
    throw new Error(`Gagal membatalkan transaksi: ${error.message}`);
  }
};
