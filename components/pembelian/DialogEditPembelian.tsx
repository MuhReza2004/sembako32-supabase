"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pembelian, PembelianDetail } from "@/app/types/pembelian";
import { useEffect, useState } from "react";
import {
  updatePembelianAndStock,
  getPembelianDetails,
  updatePembelianStatus,
} from "@/app/services/pembelian.service";
import { getAllProduk } from "@/app/services/produk.service";
import { getAllSupplierProduk } from "@/app/services/supplierProduk.service";
import { Produk } from "@/app/types/produk";
import { SupplierProduk } from "@/app/types/suplyer"; // Typo in original file: 'suplyer' should be 'supplier'
import { formatRupiah } from "@/helper/format";
import { X, Check, Package } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // onSuccess: () => void; // Replaced with onStatusReport
  pembelian: Pembelian | null;
  onStatusReport: ReturnType<typeof useStatus>["showStatus"];
}

export default function DialogEditPembelian({
  open,
  onOpenChange,
  // onSuccess, // Replaced with onStatusReport
  pembelian,
  onStatusReport,
}: Props) {
  const [no_do, setNoDO] = useState("");
  const [no_npb, setNoNPB] = useState("");
  const [invoice, setInvoice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState<PembelianDetail[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [supplierProduks, setSupplierProduks] = useState<SupplierProduk[]>([]);

  const confirm = useConfirm();

  useEffect(() => {
    const fetchData = async () => {
      if (pembelian && pembelian.id) {
        setNoDO(pembelian.no_do || "");
        setNoNPB(pembelian.no_npb || "");
        setInvoice(pembelian.invoice || "");
        try {
          const det = await getPembelianDetails(pembelian.id);
          const prods = await getAllProduk();
          const supProds = await getAllSupplierProduk();
          setDetails(det);
          setProducts(prods);
          setSupplierProduks(supProds);
        } catch (error: any) {
          console.error("Error fetching purchase details:", error);
          onStatusReport({
            message: "Gagal memuat detail pembelian: " + error.message,
            success: false,
          });
          onOpenChange(false);
        }
      }
    };
    if (open) {
      fetchData();
    }
  }, [pembelian, open, onOpenChange, onStatusReport]);

  const handleSubmit = async () => {
    if (!pembelian || !pembelian.id) return;

    setIsLoading(true);
    try {
      await updatePembelianAndStock(pembelian.id, { no_do, no_npb, invoice });
      onStatusReport({
        message: "Pembelian berhasil diterima dan stok diperbarui.",
        success: true,
        refresh: true,
      });
      // onSuccess(); // Replaced with onStatusReport
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update pembelian:", error);
      onStatusReport({
        message: "Gagal memperbarui pembelian: " + error.message,
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!pembelian || !pembelian.id) return;

    const confirmed = await confirm({
      title: "Konfirmasi Tolak Pembelian",
      message: "Apakah Anda yakin ingin menolak transaksi ini? Stok tidak akan diperbarui.",
      confirmText: "Tolak",
      cancelText: "Batal",
    });

    if (!confirmed) return;

    setIsLoading(true);
    try {
      await updatePembelianStatus(pembelian.id, "Decline");
      onStatusReport({
        message: "Pembelian telah ditolak.",
        success: true,
        refresh: true,
      });
      // onSuccess(); // Replaced with onStatusReport
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to decline transaction:", error);
      onStatusReport({
        message: "Gagal menolak transaksi: " + error.message,
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!pembelian) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            Proses Penerimaan Pembelian
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Document Information Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Update Informasi Dokumen (Opsional)
              </h3>
              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="no_do"
                    className="text-sm font-medium text-slate-700"
                  >
                    No. Delivery Order (DO)
                  </Label>
                  <Input
                    id="no_do"
                    value={no_do}
                    onChange={(e) => setNoDO(e.target.value)}
                    placeholder="Masukkan nomor DO jika ada"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="no_npb"
                    className="text-sm font-medium text-slate-700"
                  >
                    No. Penerimaan Barang (NPB)
                  </Label>
                  <Input
                    id="no_npb"
                    value={no_npb}
                    onChange={(e) => setNoNPB(e.target.value)}
                    placeholder="Masukkan nomor NPB jika ada"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="invoice"
                    className="text-sm font-medium text-slate-700"
                  >
                    Invoice / Faktur
                  </Label>
                  <Input
                    id="invoice"
                    value={invoice}
                    onChange={(e) => setInvoice(e.target.value)}
                    placeholder="Masukkan nomor invoice jika ada"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Product Details Section */}
            <div>
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-slate-800">
                <Package className="w-5 h-5 text-slate-600" />
                Detail Produk
              </h3>
              <div className="space-y-2.5">
                {details.map((detail) => {
                  const supplierProduk = supplierProduks.find(
                    (sp) => sp.id === detail.supplier_produk_id,
                  );
                  const product = products.find(
                    (p) => p.id === supplierProduk?.produk_id,
                  );
                  return (
                    <div
                      key={detail.id}
                      className="flex justify-between items-center p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 mb-1">
                          {product?.nama || "Unknown Product"}
                        </p>
                        <p className="text-sm text-slate-600">
                          Kuantitas:{" "}
                          <span className="font-medium">{detail.qty}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          {formatRupiah(detail.harga)}
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Subtotal: {formatRupiah(detail.subtotal)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
          <div className="flex flex-col-reverse  sm:flex-row gap-2.5 w-full">
            <div className="flex gap-4 flex-1">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-initial"
                disabled={isLoading}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <X className="w-4 h-4 mr-2" />
                Tolak
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className=" bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Terima
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}