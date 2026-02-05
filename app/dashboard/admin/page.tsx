"use client";

import React, { useState, useEffect } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { useDashboardData } from "@/app/hooks/useDashboard";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { useBatchedRefresh } from "@/hooks/useBatchedRefresh";

const getDateRange = (
  filter: string,
): { startDate: Date | null; endDate: Date | null } => {
  const now = new Date();
  let startDate: Date | null = new Date(now);
  let endDate: Date | null = new Date(now);

  switch (filter) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "week":
      // Adjust to start of the current week (Monday)
      const firstDayOfWeek =
        now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
      startDate = new Date(now.setDate(firstDayOfWeek));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default: // "all" or "custom"
      startDate = null;
      endDate = null;
      break;
  }
  return { startDate, endDate };
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const selectedDateRange = React.useMemo(() => {
    if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    } else {
      return getDateRange(dateFilter);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useDashboardData(selectedDateRange);
  const { schedule: scheduleRefresh } = useBatchedRefresh(refetch);

  useEffect(() => {
    // Only set up listeners if we are not in a custom date range that is empty
    const shouldListen = !(
      dateFilter === "custom" && (!customStartDate || !customEndDate)
    );

    if (shouldListen) {
      const channel = supabase.channel('dashboard-changes');
      const tables = ['penjualan', 'pembelian', 'produk', 'pelanggan', 'suppliers', 'supplier_produk'];

      tables.forEach(table => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, payload => {
            console.log(`Change detected on ${table}`, payload);
            scheduleRefresh();
        }).subscribe();
      });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [refetch, scheduleRefresh, dateFilter, customStartDate, customEndDate]);

  const handleViewInventory = () => router.push("/dashboard/admin/inventory");
  const handleViewSales = () =>
    router.push("/dashboard/admin/transaksi/penjualan");
  const handleViewPurchases = () =>
    router.push("/dashboard/admin/transaksi/pembelian");

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Dashboard Admin</h2>
          <p>Selamat datang, Admin Gudang 👋</p>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error.message || "Terjadi kesalahan saat memuat data."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Dashboard Admin</h2>
          <p className="text-muted-foreground">
            Selamat datang, Admin Gudang 👋
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select onValueChange={setDateFilter} value={dateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="week">Minggu </SelectItem>
              <SelectItem value="month">Bulan </SelectItem>
              <SelectItem value="year">Tahun</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} disabled={isLoading}>
            Refresh Data
          </Button>
        </div>
      </div>

      {dateFilter === "custom" && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Tanggal Akhir</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SummaryCards data={dashboardData ?? null} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LowStockAlerts
          items={dashboardData?.lowStockItems || []}
          isLoading={isLoading}
          onViewInventory={handleViewInventory}
        />
        <RecentTransactions
          sales={dashboardData?.recentSales || []}
          purchases={dashboardData?.recentPurchases || []}
          isLoading={isLoading}
          onViewSales={handleViewSales}
          onViewPurchases={handleViewPurchases}
        />
      </div>
    </div>
  );
}
