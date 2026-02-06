import { supabase } from "@/app/lib/supabase";
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
  pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("User tidak terautentikasi.");
  }

  // 1. Create the sale record
  const tanggalJatuhTempo = data.tanggal_jatuh_tempo || null;
  const noDo = data.no_do || null;
  const noTandaTerima = data.no_tanda_terima || null;

  const penjualanData = {
    tanggal: data.tanggal,
    pelanggan_id: data.pelanggan_id,
    catatan: data.catatan,
    no_invoice: data.no_invoice,
    no_npb: data.no_npb,
    no_do: noDo,
    no_tanda_terima: noTandaTerima,
    metode_pengambilan: data.metode_pengambilan,
    total: Number(data.total),
    total_dibayar: Number(data.total_dibayar || 0),
    status: data.status,
    metode_pembayaran: data.metode_pembayaran,
    nomor_rekening: data.nomor_rekening,
    nama_bank: data.nama_bank,
    nama_pemilik_rekening: data.nama_pemilik_rekening,
    tanggal_jatuh_tempo: tanggalJatuhTempo,
    diskon: Number(data.diskon || 0),
    pajak_enabled: data.pajak_enabled || false,
    pajak: Number(data.pajak || 0),
    total_akhir: Number(data.total_akhir || 0),
    created_by: user.id,
  };

  const { data: penjualan, error: penjualanError } = await supabase
    .from("penjualan")
    .insert(penjualanData)
    .select("id")
    .single();

  if (penjualanError) {
    console.error(
      "Error creating penjualan. Data payload:",
      JSON.stringify(penjualanData, null, 2),
    );
    console.error("Supabase Error details:", penjualanError);
    throw penjualanError;
  }

  // 2. Create penjualan_detail records and update stock
  for (const item of data.items || []) {
    await decreaseStock(item.supplier_produk_id, Number(item.qty));
    const { error: detailError } = await supabase
      .from("penjualan_detail")
      .insert({
        penjualan_id: penjualan.id,
        supplier_produk_id: item.supplier_produk_id,
        qty: Number(item.qty),
        harga: Number(item.harga),
        subtotal: Number(item.subtotal),
      });

    if (detailError) {
      console.error("Error creating penjualan detail:", detailError);
      await increaseStock(item.supplier_produk_id, Number(item.qty));
      throw detailError;
    }
  }

  // 3. Create delivery order record for "Diantar"
  if (data.metode_pengambilan === "Diantar") {
    const { error: doError } = await supabase.from("delivery_orders").insert({
      penjualan_id: penjualan.id,
      no_do: data.no_do,
      no_tanda_terima: data.no_tanda_terima,
      status: "Draft",
      tanggal_kirim: data.tanggal,
    });

    if (doError) {
      console.error("Error creating delivery order:", doError);
      throw doError;
    }
  }

  return penjualan.id;
};

// --- existing getAllPenjualan function ---
export const getAllPenjualan = async (): Promise<Penjualan[]> => {
  // First fetch penjualan dengan pelanggan
  const { data: penjualanData, error: penjualanError } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (penjualanError) {
    console.error("Error fetching penjualan:", penjualanError);
    throw penjualanError;
  }

  const createdByIds = Array.from(
    new Set(
      (penjualanData as PenjualanRow[])
        .map((item) => item.created_by)
        .filter((id): id is string => !!id),
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

  // Then fetch penjualan_detail dengan supplier_produk
  const { data: detailsData, error: detailsError } = await supabase.from(
    "penjualan_detail",
  ).select(`
      *,
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
    `);

  if (detailsError) {
    console.error("Error fetching penjualan_detail:", detailsError);
    throw detailsError;
  }


  // Join penjualan dengan penjualan_detail
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
    createdByEmail: usersMap.get(item.created_by || "")?.email,
    createdByRole: usersMap.get(item.created_by || "")?.role,
    namaPelanggan: item.pelanggan?.nama_pelanggan || "Unknown",
    alamatPelanggan: item.pelanggan?.alamat || "",
    // Get items from detailsData that belong to this penjualan
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
          hargaJual: detail.harga || detail.supplier_produk?.harga_jual_normal || detail.supplier_produk?.harga_jual,
        })) || [],
  }));

  return mappedData;
};

export const getPenjualanPage = async (params: {
  page: number;
  perPage: number;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: Penjualan[]; count: number }> => {
  const { page, perPage, searchTerm, startDate, endDate } = params;
  const from = page * perPage;
  const to = from + perPage - 1;

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
      status,
      created_at,
      updated_at,
      created_by,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
      )
    `,
      { count: "planned" },
    )
    .order("created_at", { ascending: false });

  if (startDate) {
    query = query.gte("tanggal", startDate);
  }
  if (endDate) {
    query = query.lte("tanggal", endDate);
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term) {
      query = query.or(
        `no_invoice.ilike.%${term}%,pelanggan.nama_pelanggan.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("Error fetching penjualan page:", error);
    throw error;
  }

  const rows = (data as PenjualanRow[]) || [];
  const createdByIds = Array.from(
    new Set(rows.map((item) => item.created_by).filter((id): id is string => !!id)),
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
  }));

  return { data: mappedData, count: count || 0 };
};

export const getPenjualanById = async (id: string): Promise<Penjualan | null> => {
  const { data, error } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
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
      hargaJual: detail.harga || detail.supplier_produk?.harga_jual_normal || detail.supplier_produk?.harga_jual,
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
          alamat
        )
      `,
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (penjualanError) {
    console.error("Error fetching penjualan:", penjualanError);
    throw penjualanError;
  }

  const penjualanIds = (penjualanData as PenjualanRow[] | null)
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
          hargaJual: detail.harga || detail.supplier_produk?.harga_jual_normal || detail.supplier_produk?.harga_jual,
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
}): Promise<{ data: Penjualan[]; count: number }> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("User tidak terautentikasi.");
  }

  const { page, perPage, searchTerm, startDate, endDate } = params;
  const from = page * perPage;
  const to = from + perPage - 1;

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
          alamat
        )
      `,
      { count: "planned" },
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (startDate) {
    query = query.gte("tanggal", startDate);
  }
  if (endDate) {
    query = query.lte("tanggal", endDate);
  }
  if (searchTerm) {
    const term = searchTerm.trim();
    if (term) {
      query = query.or(
        `no_invoice.ilike.%${term}%,pelanggan.nama_pelanggan.ilike.%${term}%`,
      );
    }
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
          hargaJual: detail.harga || detail.supplier_produk?.harga_jual_normal || detail.supplier_produk?.harga_jual,
        })) || [],
  }));

  return { data: mappedData, count: count || 0 };
};

export const getPenjualanSummaryForCurrentUser = async () => {
  const list = await getPenjualanForCurrentUser();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

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

// --- NEW getPiutang function ---
export const getPiutang = async (): Promise<Penjualan[]> => {
  const { data, error } = await supabase
    .from("penjualan")
    .select(
      `
      *,
      pelanggan (
        id,
        nama_pelanggan,
        alamat
      )
    `,
    )
    .eq("status", "Belum Lunas")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching piutang:", error);
    throw error;
  }
  return data as Penjualan[];
};

// --- NEW addPiutangPayment function ---
export const addPiutangPayment = async (
  penjualanId: string,
  payment: {
    tanggal: string;
    jumlah: number;
    metode_pembayaran: string;
    atas_nama: string;
  },
): Promise<void> => {
  // First, get current penjualan data
  const { data: penjualanData, error: fetchError } = await supabase
    .from("penjualan")
    .select("*")
    .eq("id", penjualanId)
    .single();

  if (fetchError || !penjualanData) {
    throw new Error("Transaksi penjualan tidak ditemukan.");
  }

  const currentTotalDibayar = penjualanData.total_dibayar || 0;
  const newTotalDibayar = currentTotalDibayar + payment.jumlah;
  const sisaUtang = penjualanData.total_akhir - newTotalDibayar;

  const newStatus = sisaUtang <= 0 ? "Lunas" : "Belum Lunas";

  // Insert payment record
  const { error: paymentError } = await supabase
    .from("riwayat_pembayaran")
    .insert({
      penjualan_id: penjualanId,
      tanggal: payment.tanggal,
      jumlah: payment.jumlah,
      metode_pembayaran: payment.metode_pembayaran,
      atas_nama: payment.atas_nama,
    });

  if (paymentError) {
    console.error("Error adding payment:", paymentError);
    throw paymentError;
  }

  // Update penjualan status and total paid
  const { error: updateError } = await supabase
    .from("penjualan")
    .update({
      total_dibayar: newTotalDibayar,
      status: newStatus,
    })
    .eq("id", penjualanId);

  if (updateError) {
    console.error("Error updating penjualan:", updateError);
    throw updateError;
  }
};

// --- existing updatePenjualanStatus function ---
export const updatePenjualanStatus = async (
  id: string,
  status: "Lunas" | "Belum Lunas" | "Batal",
): Promise<void> => {
  const { error } = await supabase
    .from("penjualan")
    .update({
      status: status,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating penjualan status:", error);
    throw error;
  }
};

// --- existing updatePenjualan function ---
export const updatePenjualan = async (
  id: string,
  data: Partial<PenjualanFormData>,
) => {
  if (data.total !== undefined) {
    assertValidMoney("Total penjualan", Number(data.total));
  }
  if (data.total_dibayar !== undefined) {
    assertValidMoney("Total dibayar", Number(data.total_dibayar));
  }
  if (data.diskon !== undefined) {
    assertValidMoney("Diskon", Number(data.diskon));
  }
  if (data.pajak !== undefined) {
    assertValidMoney("Pajak", Number(data.pajak));
  }
  if (data.total_akhir !== undefined) {
    assertValidMoney("Total akhir", Number(data.total_akhir));
  }
  if (data.items) {
    for (const item of data.items) {
      assertValidMoney("Harga item", Number(item.harga));
      assertValidMoney("Subtotal item", Number(item.subtotal));
    }
  }

  const { data: currentPenjualan, error: fetchError } = await supabase
    .from("penjualan")
    .select("*, penjualan_detail(id, supplier_produk_id, qty)")
    .eq("id", id)
    .single();

  if (fetchError || !currentPenjualan) {
    throw new Error("Transaksi penjualan tidak ditemukan.");
  }

  if (data.items) {
    // Restore old stock
    const currentDetails =
      (currentPenjualan as {
        penjualan_detail?: { supplier_produk_id: string; qty: number }[];
      }).penjualan_detail || [];
    for (const item of currentDetails) {
      await increaseStock(item.supplier_produk_id, Number(item.qty));
    }

    // Delete old details
    await supabase.from("penjualan_detail").delete().eq("penjualan_id", id);

    // Create new details and deduct new stock
    for (const item of data.items) {
      await decreaseStock(item.supplier_produk_id, Number(item.qty));
      const { error: detailError } = await supabase
        .from("penjualan_detail")
        .insert({
        penjualan_id: id,
        supplier_produk_id: item.supplier_produk_id,
        qty: item.qty,
        harga: item.harga,
        subtotal: item.subtotal,
      });
      if (detailError) {
        await increaseStock(item.supplier_produk_id, Number(item.qty));
        throw detailError;
      }
    }
  }

  // Update the main penjualan document
  const { items: _items, ...updateData } = data; // Exclude items from the main update
  void _items;
  const { error: updateError } = await supabase
    .from("penjualan")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error("Error updating penjualan:", updateError);
    throw updateError;
  }
};

// --- existing deletePenjualan function ---
export const deletePenjualan = async (id: string) => {
  const { data: penjualanDetails, error: fetchDetailsError } = await supabase
    .from("penjualan_detail")
    .select("supplier_produk_id, qty")
    .eq("penjualan_id", id);
  if (fetchDetailsError) throw fetchDetailsError;

  for (const item of penjualanDetails || []) {
    await increaseStock(item.supplier_produk_id, Number(item.qty));
  }

  await supabase.from("penjualan_detail").delete().eq("penjualan_id", id);
  await supabase.from("penjualan").delete().eq("id", id);
};

// --- NEW cancelPenjualan function ---
export const cancelPenjualan = async (id: string) => {
  const response = await fetch("/api/penjualan/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal membatalkan transaksi: ${errorText}`);
  }
};

const decreaseStock = async (supplierProdukId: string, qty: number) => {
  const { data, error } = await supabase.rpc("decrease_stock", {
    p_supplier_produk_id: supplierProdukId,
    p_qty: qty,
  });
  if (error) {
    console.error("Error decreasing stock:", error);
    throw error;
  }
  return data as number;
};

const increaseStock = async (supplierProdukId: string, qty: number) => {
  const { data, error } = await supabase.rpc("increase_stock", {
    p_supplier_produk_id: supplierProdukId,
    p_qty: qty,
  });
  if (error) {
    console.error("Error increasing stock:", error);
    throw error;
  }
  return data as number;
};

// --- existing generateInvoiceNumber function ---
export const generateInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const { count, error } = await supabase
    .from("penjualan")
    .select("*", { count: "exact", head: true })
    .gte(
      "created_at",
      new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    )
    .lt(
      "created_at",
      new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
    );

  if (error) {
    console.error("Error counting invoices:", error);
    return `INV/${year}/${month}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `INV/S32/${year}/${month}/${String(nextNumber).padStart(4, "0")}`;
};

// --- NEW generateNPBNumber function ---
export const generateNPBNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const { count, error } = await supabase
    .from("penjualan")
    .select("*", { count: "exact", head: true })
    .not("no_npb", "is", null)
    .gte("created_at", new Date(date.setHours(0, 0, 0, 0)).toISOString())
    .lt("created_at", new Date(date.setHours(23, 59, 59, 999)).toISOString());

  if (error) {
    console.error("Error counting NPB:", error);
    return `NPB/G001/${year}/${month}/${day}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `NPB/G001/${year}/${month}/${day}/${String(nextNumber).padStart(
    4,
    "0",
  )}`;
};

// --- NEW generateDONumber function ---
export const generateDONumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const { count, error } = await supabase
    .from("delivery_orders")
    .select("*", { count: "exact", head: true })
    .gte(
      "created_at",
      new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    )
    .lt(
      "created_at",
      new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
    );

  if (error) {
    console.error("Error counting DO:", error);
    return `DO/${year}/${month}/ERR`;
  }

  const nextNumber = (count || 0) + 1;
  return `DO/S32/${year}/${month}/${String(nextNumber).padStart(4, "0")}`;
};

// --- NEW generate Tanda Terima number function ---
export const generateTandaTerimaNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const { count, error } = await supabase
    .from("delivery_orders")
    .select("*", { count: "exact", head: true })
    .gte(
      "created_at",
      new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    )
    .lt(
      "created_at",
      new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
    );

  if (error) {
    console.error("Error counting Tanda Terima:", error);
    return `ERR/S32/${month}/${year}`;
  }

  const nextNumber = (count || 0) + 1;
  return `${String(nextNumber).padStart(4, "0")}/S32/${month}/${year}`;
};





