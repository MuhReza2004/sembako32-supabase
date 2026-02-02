"use client"

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <DashboardShell>
      <Card>
        <CardHeader>
          <CardTitle>Terjadi Kesalahan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || "Terjadi kesalahan yang tidak terduga"}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={reset}>Coba Lagi</Button>
            <Button variant="outline" onClick={() => window.location.href = "/dashboard/admin"}>
              Kembali ke Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
