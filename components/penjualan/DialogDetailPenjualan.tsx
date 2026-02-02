"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Penjualan } from "@/app/types/penjualan";
import { Pelanggan } from "@/app/types/pelanggan";
import { formatRupiah } from "@/helper/format";
import { getPelangganById } from "@/app/services/pelanggan.service";
import { FileText, Printer, Eye } from "lucide-react";

interface DialogDetailPenjualanProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  penjualan: Penjualan | null;
}

export const DialogDetailPenjualan: React.FC<DialogDetailPenjualanProps> = ({
  open,
  onOpenChange,
  penjualan,
}) => {
  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null);

  useEffect(() => {
    const fetchPelanggan = async () => {
      if (penjualan?.pelangganId) {
        try {
          const customerData = await getPelangganById(penjualan.pelangganId);
          setPelanggan(customerData);
        } catch (error) {
          console.error("Error fetching customer data:", error);
          setPelanggan(null);
        }
      }
    };

    if (open && penjualan) {
      fetchPelanggan();
    }
  }, [open, penjualan]);

  if (!penjualan) return null;

  const subTotal =
    penjualan.items?.reduce((sum, item) => sum + item.subtotal, 0) || 0;

  const diskonAmount =
    penjualan.diskon && penjualan.diskon > 0
      ? (subTotal * penjualan.diskon) / 100
      : 0;

  const totalSetelahDiskon = subTotal - diskonAmount;
  const pajakAmount = penjualan.pajakEnabled ? totalSetelahDiskon * 0.11 : 0;

  const handlePrintInvoice = async () => {
    try {
      const response = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...penjualan,
          namaToko: pelanggan?.namaToko,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to generate PDF (raw response):", errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error("Failed to generate PDF (parsed):", errorData);
          throw new Error(
            `Failed to generate PDF: ${errorData.details || "Unknown error"}`,
          );
        } catch (e) {
          throw new Error(`Failed to generate PDF: ${errorText}`);
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Terjadi kesalahan saat membuat preview invoice PDF.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText />
            Detail Penjualan
          </DialogTitle>
          <DialogDescription>
            Rincian untuk invoice #{penjualan.nomorInvoice}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-gray-50 border">
            <div>
              <p className="text-sm text-gray-500">Pelanggan</p>
              <p className="font-semibold">{penjualan.namaPelanggan}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nama Toko</p>
              <p className="font-semibold">{pelanggan?.namaToko || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Alamat Pelanggan</p>
              <p className="font-semibold">{penjualan.alamatPelanggan}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tanggal</p>
              <p className="font-semibold">
                {new Date(penjualan.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge
                className={
                  penjualan.status === "Lunas"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }
              >
                {penjualan.status}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-sm text-black font-bold">Metode Pembayaran</p>
            <p className="font-semibold capitalize">
              {penjualan.metodePembayaran}
            </p>
            {penjualan.metodePembayaran === "Transfer" &&
              penjualan.namaBank && (
                <p className="text-xs text-gray-600 mt-1">
                  Nama Bank: {penjualan.namaBank}
                </p>
              )}
            {penjualan.metodePembayaran === "Transfer" &&
              penjualan.namaPemilikRekening && (
                <p className="text-xs text-gray-600 mt-1">
                  Nama Pemilik Rekening: {penjualan.namaPemilikRekening}
                </p>
              )}
            {penjualan.metodePembayaran === "Transfer" &&
              penjualan.nomorRekening && (
                <p className="text-xs text-gray-600 mt-1">
                  Nomor Rekening: {penjualan.nomorRekening}
                </p>
              )}
          </div>

          {penjualan.status === "Belum Lunas" &&
            penjualan.tanggalJatuhTempo && (
              <div>
                <p>Tanggal Jatuh Tempo</p>
                <p className="font-semibold">
                  {new Date(penjualan.tanggalJatuhTempo).toLocaleDateString(
                    "id-ID",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </p>
              </div>
            )}

          <div>
            <h3 className="font-semibold mb-2">Item yang Dibeli:</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-center">Satuan</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {penjualan.items && penjualan.items.length > 0 ? (
                    penjualan.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.namaProduk}</TableCell>
                        <TableCell className="text-center">
                          {item.qty}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.satuan}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(item.hargaJual || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-gray-500"
                      >
                        Tidak ada item
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Subtotal:</div>
                <div className="text-right">{formatRupiah(subTotal)}</div>
                {penjualan.diskon && penjualan.diskon > 0 && (
                  <>
                    <div>Diskon ({penjualan.diskon}%):</div>
                    <div className="text-right text-red-600">
                      -{formatRupiah(diskonAmount)}
                    </div>
                  </>
                )}
                {penjualan.pajakEnabled && pajakAmount > 0 && (
                  <>
                    <div>PPN 11%:</div>
                    <div className="text-right">
                      {formatRupiah(pajakAmount)}
                    </div>
                  </>
                )}
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">
                    Total Akhir
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    {formatRupiah(penjualan.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            onClick={handlePrintInvoice}
            className="flex items-center gap-2"
          >
            <Printer size={16} />
            Cetak Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
