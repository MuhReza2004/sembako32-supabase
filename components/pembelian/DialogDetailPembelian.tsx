"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pembelian } from "@/app/types/pembelian";
import { formatRupiah } from "@/helper/format";
import { useEffect, useState } from "react";
import { getPembelianDetails } from "@/app/services/pembelian.service";
import { PembelianDetail } from "@/app/types/pembelian";
import { getAllSuppliers } from "@/app/services/supplyer.service";
import { getAllProduk } from "@/app/services/produk.service";
import { getAllSupplierProduk } from "@/app/services/supplierProduk.service";
import { Supplier, SupplierProduk } from "@/app/types/suplyer";
import { Produk } from "@/app/types/produk";

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [supplierProduks, setSupplierProduks] = useState<SupplierProduk[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (pembelian && pembelian.id) {
        const det = await getPembelianDetails(pembelian.id);
        const sups = await getAllSuppliers();
        const prods = await getAllProduk();
        const supProds = await getAllSupplierProduk();
        setDetails(det);
        setSuppliers(sups);
        setProducts(prods);
        setSupplierProduks(supProds);
      }
    };
    fetchData();
  }, [pembelian]);

  if (!pembelian) return null;

  const supplier = suppliers.find((s) => s.id === pembelian.supplierId);

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
              <p>{pembelian.noDO || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                No NPB
              </label>
              <p>{pembelian.noNPB || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Invoice
              </label>
              <p>{pembelian.invoice || "-"}</p>
            </div>
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
              {details.map((detail, index) => {
                const supplierProduk = supplierProduks.find(
                  (sp) => sp.id === detail.supplierProdukId,
                );
                const product = products.find(
                  (p) => p.id === supplierProduk?.produkId,
                );
                return (
                  <div
                    key={detail.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {product?.nama || "Unknown Product"}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
