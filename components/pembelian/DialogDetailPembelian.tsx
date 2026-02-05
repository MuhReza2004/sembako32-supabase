"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pembelian } from "@/app/types/pembelian";
import { formatRupiah } from "@/helper/format";
import { useEffect, useState } from "react";
import { getPembelianDetails } from "@/app/services/pembelian.service";
import { PembelianDetail } from "@/app/types/pembelian";
import { getAllSuppliers } from "@/app/services/supplier.service";
import { Supplier } from "@/app/types/supplier";
import { Button } from "../ui/button";
import { useCachedList } from "@/hooks/useCachedList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pembelian: Pembelian | null;
}

export default function DialogDetailPembelian({
  open,
  onOpenChange,
  pembelian,
}: Props) {
  const [details, setDetails] = useState<PembelianDetail[]>([]);
  const {
    data: suppliers,
    error: suppliersError,
  } = useCachedList<Supplier>(getAllSuppliers, {
    enabled: open,
    forceOnEnable: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (pembelian && pembelian.id) {
        const det = await getPembelianDetails(pembelian.id);
        setDetails(det);
      }
    };
    if (open) {
      fetchData();
    }
  }, [pembelian, open]);

  useEffect(() => {
    if (open && suppliersError) {
      console.error("Failed to fetch suppliers:", suppliersError);
    }
  }, [open, suppliersError]);

  if (!pembelian) return null;

  const supplier = suppliers.find((s) => s.id === pembelian.supplier_id);

  const metodePembayaran = pembelian.metode_pembayaran || "Tunai";

  const handleGeneratePdf = async () => {
    const newTab = window.open("", "_blank");
    if (!newTab) {
      alert("Gagal membuka tab baru. Mohon izinkan pop-up untuk situs ini.");
      return;
    }
    newTab.document.write("Menghasilkan PDF, mohon tunggu...");

    try {
      const response = await fetch("/api/generate-purchase-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pembelianId: pembelian.id }),
      });

      if (!response.ok) throw new Error("Gagal generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      newTab.location.href = url;
    } catch (error) {
      console.error("Error generating PDF:", error);
      if (newTab) {
        newTab.document.body.innerHTML = `<pre>Gagal membuat PDF. Silakan periksa konsol untuk detailnya.</pre>`;
      }
      alert("Gagal mengekspor PDF. Silakan coba lagi.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detail Pembelian</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Supplier
              </label>
              <p className="text-lg font-semibold">
                {supplier?.nama || "Unknown Supplier"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Tanggal
              </label>
              <p>{new Date(pembelian.tanggal).toLocaleDateString("id-ID")}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">No DO</label>
              <p>{pembelian.no_do || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                No NPB
              </label>
              <p>{pembelian.no_npb || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Invoice
              </label>
              <p>{pembelian.invoice || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Metode Pembayaran
              </label>
              <p>{metodePembayaran}</p>
            </div>
            {metodePembayaran === "Transfer" && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Nama Bank
                  </label>
                  <p>{pembelian.nama_bank || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Nama Pemilik Rekening
                  </label>
                  <p>{pembelian.nama_pemilik_rekening || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    No. Rekening
                  </label>
                  <p>{pembelian.nomor_rekening || "-"}</p>
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">Total</label>
              <p className="text-lg font-bold text-blue-600">
                {formatRupiah(pembelian.total)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Detail Produk</h3>
            <div className="space-y-2">
              {details.map((detail) => {
                return (
                  <div
                    key={detail.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {detail.namaProduk || "Unknown Product"}
                      </p>
                      <p className="text-sm text-gray-600">Qty: {detail.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatRupiah(detail.harga)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatRupiah(detail.subtotal)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant={"primary"}
              onClick={handleGeneratePdf}
            >
              Generate PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
