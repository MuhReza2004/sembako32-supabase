"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function NotFound() {
  return (
    <DashboardShell>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Tidak Ditemukan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/dashboard/admin">Kembali ke Dashboard</Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
