"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryData } from "@/app/dashboard/admin/inventory/page";

interface InventoryTableProps {
  inventoryData: InventoryData[];
  isLoading?: boolean;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  inventoryData,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Memuat data inventory...</div>
      </div>
    );
  }

  if (inventoryData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Belum ada data inventory.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-100">
            <TableHead>Nama Produk</TableHead>
            <TableHead className="text-right">Stok Awal</TableHead>
            <TableHead className="text-right text-green-600">
              Stok Masuk
            </TableHead>
            <TableHead className="text-right text-red-600">
              Stok Keluar
            </TableHead>
            <TableHead className="text-right">Stok Akhir</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventoryData.map((item) => {
            const currentStok = item.stok || 0;
            const stokAwal = currentStok - item.totalMasuk + item.totalKeluar;
            return (
              <TableRow key={item.id} className="border-b hover:bg-gray-50">
                <TableCell className="font-medium">{item.nama}</TableCell>
                <TableCell className="text-right">{stokAwal}</TableCell>
                <TableCell className="text-right text-green-600">
                  +{item.totalMasuk}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  -{item.totalKeluar}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {currentStok}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="bg-gray-50 px-6 py-3 border-t text-sm text-gray-600">
        Total menampilkan{" "}
        <span className="font-semibold">{inventoryData.length}</span> produk.
      </div>
    </div>
  );
};
