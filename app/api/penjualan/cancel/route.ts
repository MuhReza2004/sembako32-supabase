import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;
    const { role, userId } = guard;

    const { id } = (await request.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const { data: penjualan, error: fetchError } = await supabaseAdmin
      .from("penjualan")
      .select("id, created_by, status, penjualan_detail(supplier_produk_id, qty)")
      .eq("id", id)
      .single();

    if (fetchError || !penjualan) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 },
      );
    }

    if (role !== "admin" && penjualan.created_by !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (penjualan.status === "Batal") {
      return NextResponse.json({ ok: true, status: "Batal" });
    }

    const details = (penjualan as {
      penjualan_detail?: { supplier_produk_id: string; qty: number }[];
    }).penjualan_detail || [];

    for (const item of details) {
      const { data: p, error: stockError } = await supabaseAdmin
        .from("supplier_produk")
        .select("stok")
        .eq("id", item.supplier_produk_id)
        .single();
      if (stockError || !p) {
        return NextResponse.json(
          { error: "stok_not_found" },
          { status: 400 },
        );
      }
      await supabaseAdmin
        .from("supplier_produk")
        .update({ stok: p.stok + item.qty })
        .eq("id", item.supplier_produk_id);
    }

    const { error: updateError } = await supabaseAdmin
      .from("penjualan")
      .update({ status: "Batal" })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "update_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, status: "Batal" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "cancel_failed", details: message },
      { status: 500 },
    );
  }
}

