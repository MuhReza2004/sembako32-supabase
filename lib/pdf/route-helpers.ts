import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/api-guard";
import { rateLimit } from "@/app/lib/rate-limit";
import type { PdfAuth } from "@/lib/pdf/penjualan-data";

// Auth + rate limit bersama untuk route PDF dokumen penjualan.
export const guardPdfRequest = async (
  request: NextRequest,
  key: string,
  limitPerMinute: number,
): Promise<{ ok: true; auth: PdfAuth } | { ok: false; response: NextResponse }> => {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard;

  const limit = rateLimit(`pdf:${key}:${guard.userId}`, limitPerMinute, 60_000);
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return {
      ok: false,
      response: NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  return { ok: true, auth: { userId: guard.userId, role: guard.role } };
};

export const readJsonBody = async (
  request: NextRequest,
): Promise<Record<string, unknown>> => {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export const stringField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export const pdfResponse = (buffer: Uint8Array, filename: string) =>
  new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]+/g, "_")}"`,
    },
  });

export const pdfError = (message: string, error: unknown) => {
  console.error(message, error);
  return NextResponse.json(
    {
      error: message,
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
};
