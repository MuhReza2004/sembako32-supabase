import { supabaseAdmin } from "@/lib/supabase-admin";
import { Penjualan, PenjualanDetail } from "@/app/types/penjualan";

// Data dokumen PDF selalu diambil dari database (bukan dari body request),
// agar isi invoice/kwitansi/DO/BAST tidak bisa dimanipulasi dari browser.

export type PenjualanPdfData = Penjualan & {
  nama_pelanggan?: string;
  nama_toko?: string;
  no_telp?: string;
};

export type DOItem = {
  qty: number;
  satuan?: string;
  harga?: number;
  subtotal?: number;
  supplier_produk?: { produk?: { nama?: string; satuan?: string } };
};

export type DeliveryOrderPdfData = {
  no_do: string;
  no_tanda_terima?: string;
  penjualan: {
    no_invoice?: string;
    no_npb?: string;
    tanggal: string;
    pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
    items?: DOItem[];
  };
};

export type PdfAuth = { userId: string; role: string };

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type DetailRow = Pick<
  PenjualanDetail,
  "id" | "penjualan_id" | "supplier_produk_id" | "qty" | "harga" | "subtotal" | "created_at"
> & {
  supplier_produk?: { produk?: { nama?: string; satuan?: string } | null } | null;
};

type PenjualanRow = Penjualan & {
  pelanggan?: {
    nama_pelanggan?: string;
    alamat?: string;
    nama_toko?: string;
    no_telp?: string;
  } | null;
  penjualan_detail?: DetailRow[];
};

export const loadPenjualanForPdf = async (
  penjualanId: string,
  auth: PdfAuth,
): Promise<LoadResult<PenjualanPdfData>> => {
  if (!penjualanId) {
    return { ok: false, status: 400, error: "missing_penjualan_id" };
  }

  const { data, error } = await supabaseAdmin
    .from("penjualan")
    .select(
      `*,
      pelanggan ( nama_pelanggan, alamat, nama_toko, no_telp ),
      penjualan_detail (
        id, penjualan_id, supplier_produk_id, qty, harga, subtotal, created_at,
        supplier_produk ( produk ( nama, satuan ) )
      )`,
    )
    .eq("id", penjualanId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "db_error" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "not_found" };
  }

  const row = data as PenjualanRow;
  if (auth.role !== "admin" && row.created_by !== auth.userId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const { pelanggan, penjualan_detail, ...rest } = row;
  const namaPelanggan = pelanggan?.nama_pelanggan || "";

  return {
    ok: true,
    data: {
      ...rest,
      namaPelanggan,
      nama_pelanggan: namaPelanggan,
      alamatPelanggan: pelanggan?.alamat || "",
      nama_toko: pelanggan?.nama_toko || "",
      no_telp: pelanggan?.no_telp || "",
      items: (penjualan_detail || []).map((d) => ({
        id: d.id,
        penjualan_id: d.penjualan_id,
        supplier_produk_id: d.supplier_produk_id,
        qty: Number(d.qty),
        harga: Number(d.harga),
        subtotal: Number(d.subtotal),
        created_at: d.created_at,
        namaProduk: d.supplier_produk?.produk?.nama || "Produk",
        satuan: d.supplier_produk?.produk?.satuan || "",
        hargaJual: Number(d.harga),
      })),
      total: Number(rest.total),
      total_akhir:
        rest.total_akhir !== null && rest.total_akhir !== undefined
          ? Number(rest.total_akhir)
          : undefined,
      total_dibayar: Number(rest.total_dibayar ?? 0),
      diskon: Number(rest.diskon ?? 0),
      pajak: Number(rest.pajak ?? 0),
    },
  };
};

// Delivery order dapat dicari lewat id DO atau id penjualan.
export const loadDeliveryOrderForPdf = async (
  ids: { deliveryOrderId?: string; penjualanId?: string },
  auth: PdfAuth,
): Promise<LoadResult<DeliveryOrderPdfData>> => {
  let query = supabaseAdmin
    .from("delivery_orders")
    .select("id, penjualan_id, no_do, no_tanda_terima");
  if (ids.deliveryOrderId) {
    query = query.eq("id", ids.deliveryOrderId);
  } else if (ids.penjualanId) {
    query = query.eq("penjualan_id", ids.penjualanId);
  } else {
    return { ok: false, status: 400, error: "missing_delivery_order_id" };
  }

  const { data: doRow, error } = await query.limit(1).maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "db_error" };
  }
  if (!doRow) {
    return { ok: false, status: 404, error: "delivery_order_not_found" };
  }

  const penjualan = await loadPenjualanForPdf(doRow.penjualan_id as string, auth);
  if (!penjualan.ok) return penjualan;

  return { ok: true, data: toDeliveryOrderPdfData(penjualan.data, doRow) };
};

export const toDeliveryOrderPdfData = (
  p: PenjualanPdfData,
  doRow: { no_do: string; no_tanda_terima?: string | null },
): DeliveryOrderPdfData => ({
  no_do: doRow.no_do,
  no_tanda_terima: doRow.no_tanda_terima || undefined,
  penjualan: {
    no_invoice: p.no_invoice,
    no_npb: p.no_npb,
    tanggal: p.tanggal,
    pelanggan: { nama_pelanggan: p.namaPelanggan, alamat: p.alamatPelanggan },
    items: (p.items || []).map((item) => ({
      qty: item.qty,
      harga: item.harga,
      subtotal: item.subtotal,
      satuan: item.satuan || undefined,
      supplier_produk: {
        produk: { nama: item.namaProduk || "Produk", satuan: item.satuan || undefined },
      },
    })),
  },
});

// Opsi tampilan invoice. Nilai watermark & nominal ditentukan dari data DB,
// client hanya boleh memilih varian dokumen.
export type InvoiceVariant = "invoice" | "pembayaran";

export const isPenjualanLunas = (p: PenjualanPdfData) =>
  p.status !== "Batal" &&
  Number(p.total_dibayar ?? 0) >= Number(p.total_akhir ?? p.total ?? 0);

export const buildInvoiceOptions = (
  p: PenjualanPdfData,
  variant: InvoiceVariant,
) => {
  const lunas = isPenjualanLunas(p);
  if (variant === "pembayaran") {
    return {
      watermarkText: lunas ? "LUNAS" : undefined,
      invoiceTitle: "INVOICE PEMBAYARAN PIUTANG",
      amountLabel: "Total yang Dibayar",
      amountValue: Number(p.total_dibayar ?? 0),
    };
  }
  return {
    watermarkText: p.status === "Batal" ? "BATAL" : lunas ? "LUNAS" : undefined,
  };
};
