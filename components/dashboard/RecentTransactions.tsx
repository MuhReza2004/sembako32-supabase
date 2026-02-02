"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Truck, Clock } from "lucide-react";

interface RecentSale {
  id: string;
  kode: string;
  tanggal: Date;
  total: number;
  status: string;
  pelanggan?: string;
}

interface RecentPurchase {
  id: string;
  kode: string;
  tanggal: Date;
  total: number;
  status: string;
  supplier?: string;
}

interface RecentTransactionsProps {
  sales: RecentSale[];
  purchases: RecentPurchase[];
  isLoading?: boolean;
  onViewSales?: () => void;
  onViewPurchases?: () => void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  sales,
  purchases,
  isLoading = false,
  onViewSales,
  onViewPurchases,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    try {
      // Check if date is valid
      if (
        !date ||
        isNaN(date.getTime()) ||
        date.toString() === "Invalid Date"
      ) {
        console.error("Invalid date received:", date);
        return "Tanggal tidak valid";
      }
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", date, error);
      return "Tanggal tidak valid";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mr-2" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentItems = [
    ...sales.slice(0, 3).map((sale) => ({
      ...sale,
      type: "sale" as const,
    })),
    ...purchases.slice(0, 3).map((purchase) => ({
      ...purchase,
      type: "purchase" as const,
    })),
  ].sort((a, b) => {
    const dateA = new Date(a.tanggal).getTime();
    const dateB = new Date(b.tanggal).getTime();
    return dateB - dateA;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-blue-500 mr-2" />
            Transaksi Terbaru
          </div>
          <div className="flex gap-2">
            {onViewSales && (
              <Button variant="outline" size="sm" onClick={onViewSales}>
                Penjualan
              </Button>
            )}
            {onViewPurchases && (
              <Button variant="outline" size="sm" onClick={onViewPurchases}>
                Pembelian
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3">
                  {item.type === "sale" ? (
                    <ShoppingCart className="h-4 w-4 text-green-500" />
                  ) : (
                    <Truck className="h-4 w-4 text-blue-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{item.kode}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.tanggal)} •{" "}
                      {item.type === "sale" ? item.pelanggan : item.supplier}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatCurrency(item.total)}
                  </p>
                  <p
                    className={`text-xs ${
                      item.status === "Lunas"
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
