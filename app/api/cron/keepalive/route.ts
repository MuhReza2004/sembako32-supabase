import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

const CRON_SECRET = process.env.CRON_SECRET;

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json(
      { ok: false, error: "missing_cron_secret" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token || token !== CRON_SECRET) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const { error } = await supabaseAdmin
    .from("produk")
    .select("id", { head: true })
    .limit(1);

  if (error) {
    console.error("Cron keepalive failed:", error);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
  });
}
