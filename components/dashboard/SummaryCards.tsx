"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Users,
  Truck,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
} from "lucide-react";

interface DashboardData {
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalSales: number;
  totalPurchases: number;
  totalRevenue: number;
  totalExpenses: number;
  lowStockItems: any[];
  recentSales: any[];
  recentPurchases: any[];
  totalPiutang: number;
  totalNominalPiutang: number;
}

interface SummaryCardsProps {
  data: DashboardData | null;
  isLoading?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  data,
  isLoading = false,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: "Total Produk",
      value: data?.totalProducts || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Pelanggan",
      value: data?.totalCustomers || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Supplier",
      value: data?.totalSuppliers || 0,
      icon: Truck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Penjualan",
      value: data?.totalSales || 0,
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Total Pembelian",
      value: data?.totalPurchases || 0,
      icon: ShoppingCart,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Total Pendapatan",
      value: data?.totalRevenue || 0,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      isCurrency: true,
    },
    {
      title: "Total Pengeluaran",
      value: data?.totalExpenses || 0,
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
      isCurrency: true,
    },
    {
      title: "Total Piutang",
      value: data?.totalPiutang || 0,
      icon: CreditCard,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Nominal Piutang",
      value: data?.totalNominalPiutang || 0,
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-50",
      isCurrency: true,
    },
    {
      title: "Keuntungan Bersih",
      value: (data?.totalRevenue || 0) - (data?.totalExpenses || 0),
      icon: DollarSign,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      isCurrency: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold">
                  {card.isCurrency
                    ? formatCurrency(card.value as number)
                    : card.value.toLocaleString("id-ID")}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
