"use client";

import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pelanggan } from "@/app/types/pelanggan";
import { Edit2, Trash2 } from "lucide-react";

interface TabelPelangganProps {
  customers: Pelanggan[];
  isLoading?: boolean;
  onEdit: (customer: Pelanggan) => void;
  onDelete: (customer: Pelanggan) => void;
}

export const TabelPelanggan: React.FC<TabelPelangganProps> = ({
  customers,
  isLoading = false,
  onEdit,
  onDelete,
  searchTerm = "",
}) => {
  const [deletingId, setDeleteingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Memuat data pelanggan...</div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">"Pelanggan tidak ditemukan"</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-100">
            <TableHead className="font-semibold text-gray-700 w-12">
              No
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Nama Pelanggan
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Kode Pelanggan
            </TableHead>
            <TableHead className="font-semibold text-gray-700">NIB</TableHead>
            <TableHead className="font-semibold text-gray-700">
              No. Telp
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Nama Toko
            </TableHead>
            <TableHead className="font-semibold text-gray-700">
              Alamat
            </TableHead>
            <TableHead className="font-semibold text-gray-700 text-center">
              Status
            </TableHead>
            <TableHead className="font-semibold text-gray-700 text-center">
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer, index) => {
            const statusColor =
              customer.status === "aktif"
                ? "text-green-600 bg-green-50"
                : "text-red-600 bg-red-50";

            return (
              <TableRow
                key={customer.id_pelanggan}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <TableCell className="text-gray-700 font-medium">
                  {index + 1}
                </TableCell>
                <TableCell className="text-gray-700 font-medium">
                  {customer.nama_pelanggan}
                </TableCell>
                <TableCell className="text-gray-700 text-sm">
                  {customer.kode_pelanggan}
                </TableCell>

                <TableCell className="text-gray-700 text-sm">
                  {customer.nib || "-"}
                </TableCell>
                <TableCell className="text-gray-700 text-sm">
                  {customer.no_telp || "-"}
                </TableCell>
                <TableCell className="text-gray-700 text-sm">
                  {customer.nama_toko || "-"}
                </TableCell>
                <TableCell className="text-gray-700 text-sm max-w-xs truncate">
                  {customer.alamat || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
                  >
                    {customer.status === "aktif" ? "✓ Aktif" : "✕ Nonaktif"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onEdit(customer)}
                      className="h-8 px-2"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="remove"
                      onClick={() => {
                        setDeleteingId(customer.id_pelanggan);
                        onDelete(customer);
                      }}
                      disabled={deletingId === customer.id_pelanggan}
                      className="h-8 px-2"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Footer dengan info */}
      <div className="bg-gray-50 px-6 py-3 border-t text-sm text-gray-600">
        Menampilkan <span className="font-semibold">{customers.length}</span>{" "}
        pelanggan
        {searchTerm && ` (Pencarian: "${searchTerm}")`}
      </div>
    </div>
  );
};
