import { supabase } from "../lib/supabase";

export interface DashboardData {
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalSales: number;
  totalPurchases: number;
  totalRevenue: number;
  totalExpenses: number;
  lowStockItems: LowStockItem[];
  recentSales: RecentTransaction[];
  recentPurchases: RecentTransaction[];
  totalPiutang: number;
  totalNominalPiutang: number;
}

export interface LowStockItem {
  id: string;
  nama: string;
  kode: string;
  currentStock: number;
  minStock: number;
}

export interface RecentTransaction {
  id: string;
  kode: string;
  tanggal: string;
  total: number;
  status: string;
  pelanggan?: string;
  supplier?: string;
}

export const getDashboardData = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<DashboardData> => {
  try {
    const [
      products,
      customers,
      suppliers,
      sales,
      purchases,
      revenue,
      expenses,
      lowStockItems,
      recentSales,
      recentPurchases,
      piutang,
    ] = await Promise.all([
      getTotalProducts(),
      getTotalCustomers(),
      getTotalSuppliers(),
      getTotalSales(dateRange),
      getTotalPurchases(dateRange),
      getTotalRevenue(dateRange),
      getTotalExpenses(dateRange),
      getLowStockItems(),
      getRecentSales(dateRange),
      getRecentPurchases(dateRange),
      getTotalPiutang(dateRange),
    ]);

    return {
      totalProducts: products,
      totalCustomers: customers,
      totalSuppliers: suppliers,
      totalSales: sales,
      totalPurchases: purchases,
      totalRevenue: revenue,
      totalExpenses: expenses,
      lowStockItems,
      recentSales,
      recentPurchases,
      totalPiutang: piutang.count,
      totalNominalPiutang: piutang.total,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
};

const getTotalProducts = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("produk")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting products:", error);
    return 0;
  }

  return count || 0;
};

const getTotalCustomers = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("pelanggan")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting customers:", error);
    return 0;
  }

  return count || 0;
};

const getTotalSuppliers = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting suppliers:", error);
    return 0;
  }

  return count || 0;
};

const getTotalSales = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<number> => {
  let query = supabase.from("penjualan").select("*", { count: "exact", head: true });

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error counting sales:", error);
    return 0;
  }

  return count || 0;
};

const getTotalPurchases = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<number> => {
  let query = supabase.from("pembelian").select("*", { count: "exact", head: true });

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error counting purchases:", error);
    return 0;
  }

  return count || 0;
};

const getTotalRevenue = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<number> => {
  let query = supabase.from("penjualan").select("total, status");

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching total revenue:", error);
    return 0;
  }

  let total = 0;
  data.forEach((sale) => {
    if (sale.status !== "Batal") {
      total += sale.total || 0;
    }
  });

  return total;
};

const getTotalExpenses = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<number> => {
  let query = supabase.from("pembelian").select("total, status");

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching total expenses:", error);
    return 0;
  }

  let total = 0;
  data.forEach((purchase) => {
    if (purchase.status !== "Decline") {
      total += purchase.total || 0;
    }
  });

  return total;
};

const getTotalPiutang = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<{ count: number; total: number }> => {
  let query = supabase
    .from("penjualan")
    .select("total, total_dibayar", { count: "exact" })
    .eq("status", "Belum Lunas");

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching total piutang:", error);
    return { count: 0, total: 0 };
  }

  let totalNominal = 0;
  data.forEach((sale) => {
    const totalDibayar = sale.total_dibayar || 0;
    const sisaTagihan = sale.total - totalDibayar;
    totalNominal += sisaTagihan;
  });

  return { count: count || 0, total: totalNominal };
};

const getLowStockItems = async (): Promise<LowStockItem[]> => {
  const { data: produkData, error: produkError } = await supabase
    .from("produk")
    .select("id, nama, kode");

  if (produkError) {
    console.error("Error fetching produk for low stock:", produkError);
    return [];
  }

  const { data: supplierProdukData, error: supplierProdukError } = await supabase
    .from("supplier_produk")
    .select("produk_id, stok");

  if (supplierProdukError) {
    console.error("Error fetching supplier produk for low stock:", supplierProdukError);
    return [];
  }

  const supplierProdukMap = new Map<string, number>(); // Map<produk_id, total_stok>
  supplierProdukData.forEach((sp) => {
    supplierProdukMap.set(sp.produk_id, (supplierProdukMap.get(sp.produk_id) || 0) + sp.stok);
  });

  const lowStockItems: LowStockItem[] = [];
  const minStock = 10;

  produkData.forEach((produk) => {
    const currentStock = supplierProdukMap.get(produk.id) || 0;

    if (currentStock < minStock) {
      lowStockItems.push({
        id: produk.id,
        nama: produk.nama,
        kode: produk.kode,
        currentStock,
        minStock,
      });
    }
  });

  return lowStockItems
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 5);
};

const getRecentSales = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<RecentTransaction[]> => {
  let query = supabase
    .from("penjualan")
    .select(
      `
      id,
      no_invoice,
      created_at,
      total,
      status,
      pelanggan (
        nama_pelanggan,
        nama_toko
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  } else {
    query = query.limit(3);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent sales:", error);
    return [];
  }

  return data.map((sale) => {
    const pelangganRaw = Array.isArray(sale.pelanggan)
      ? sale.pelanggan[0]
      : sale.pelanggan;
    return {
      id: sale.id,
      kode: sale.no_invoice || `SL-${sale.id.slice(-6)}`,
      tanggal: sale.created_at,
      total: sale.total || 0,
      status: sale.status || "Belum Lunas",
      pelanggan:
        pelangganRaw?.nama_toko ||
        pelangganRaw?.nama_pelanggan ||
        "Unknown",
    };
  });
};

const getRecentPurchases = async (dateRange?: {
  startDate: Date | null;
  endDate: Date | null;
}): Promise<RecentTransaction[]> => {
  let query = supabase
    .from("pembelian")
    .select(
      `
      id,
      invoice,
      created_at,
      total,
      status,
      suppliers (
        nama
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (dateRange && dateRange.startDate && dateRange.endDate) {
    query = query
      .gte("created_at", dateRange.startDate.toISOString())
      .lte("created_at", dateRange.endDate.toISOString());
  } else {
    query = query.limit(3);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recent purchases:", error);
    return [];
  }

  return data.map((purchase) => {
    const supplierRaw = Array.isArray(purchase.suppliers)
      ? purchase.suppliers[0]
      : purchase.suppliers;
    return {
      id: purchase.id,
      kode: purchase.invoice || `PB-${purchase.id.slice(-6)}`,
      tanggal: purchase.created_at,
      total: purchase.total || 0,
      status: purchase.status || "Pending",
      supplier: supplierRaw?.nama || "Unknown",
    };
  });
};
