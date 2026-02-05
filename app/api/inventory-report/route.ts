import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type InventoryRow = {
  id: string;
  stok?: number;
  totalmasuk?: number;
  totalkeluar?: number;
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request);
    if (!guard.ok) return guard.response;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(`inventory-report:${ip}`, 30, 60_000);
    if (!limit.ok) {
      const retryAfter = Math.max(
        1,
        Math.ceil((limit.resetAt - Date.now()) / 1000),
      );
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_report")
      .select("*");
    if (error) throw error;

    const mapped = (data as InventoryRow[]).map((row) => ({
      ...row,
      stok: row.stok ?? 0,
      totalMasuk: row.totalmasuk ?? 0,
      totalKeluar: row.totalkeluar ?? 0,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return new NextResponse(
      JSON.stringify({ error: "Gagal memuat data inventory: " + errorMessage }),
      { status: 500 },
    );
  }
}

