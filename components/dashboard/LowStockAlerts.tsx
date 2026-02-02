"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LowStockItem {
  id: string;
  nama: string;
  kode: string;
  currentStock: number;
  minStock: number;
}

interface LowStockAlertsProps {
  items: LowStockItem[];
  isLoading?: boolean;
  onViewInventory?: () => void;
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  items,
  isLoading = false,
  onViewInventory,
}) => {
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
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            Peringatan Stok Rendah
          </div>
          {onViewInventory && (
            <Button variant="outline" size="sm" onClick={onViewInventory}>
              Lihat Semua
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Semua produk memiliki stok yang cukup
          </p>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center space-x-3">
                  <Package className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">{item.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      Kode: {item.kode}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    {item.currentStock}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Min: {item.minStock}
                  </p>
                </div>
              </div>
            ))}
            {items.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                +{items.length - 5} produk lainnya
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
