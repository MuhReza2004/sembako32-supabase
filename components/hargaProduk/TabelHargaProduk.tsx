"use client";

import { useMemo } from "react";
import { SupplierProduk } from "@/app/types/supplier";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAllSuppliers } from "@/app/services/supplier.service";
import { getAllProduk } from "@/app/services/produk.service";
import { Supplier } from "@/app/types/supplier";
import { Produk } from "@/app/types/produk";
import { formatRupiah } from "@/helper/format";
import { useCachedList } from "@/hooks/useCachedList";

interface Props {
  data: SupplierProduk[];
  onEdit: (item: SupplierProduk) => void;
  onDelete: (item: SupplierProduk) => void;
  onAddProduct: (supplierId: string) => void;
}

export default function TabelHargaProduk({
  data,
  onEdit,
  onDelete,
  onAddProduct,
}: Props) {
  const { data: suppliers } = useCachedList<Supplier>(getAllSuppliers);
  const { data: products } = useCachedList<Produk>(getAllProduk);

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.nama || supplierId;
  };

  const getProductName = (produkId: string) => {
    const product = products.find((p) => p.id === produkId);
    return product?.nama || produkId;
  };

  // Group data by supplier
  const groupedData = useMemo(
    () =>
      data.reduce(
        (acc, item) => {
          if (!acc[item.supplier_id]) {
            acc[item.supplier_id] = [];
          }
          acc[item.supplier_id].push(item);
          return acc;
        },
        {} as Record<string, SupplierProduk[]>,
      ),
    [data],
  );

  return (
    <div className="space-y-6">
      {Object.entries(groupedData).map(([supplierId, items]) => (
        <Card key={supplierId} className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Supplier: {getSupplierName(supplierId)}
            </h3>
            <Button
              onClick={() => onAddProduct(supplierId)}
              size="sm"
              variant="primary"
            >
              + Tambah Produk
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Harga Beli</th>
                  <th className="px-4 py-3">Harga Jual</th>
                  <th className="px-4 py-3">Stok</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      {getProductName(item.produk_id)}
                    </td>
                    <td className="px-4 py-3">
                      {formatRupiah(item.harga_beli)}
                    </td>
                    <td className="px-4 py-3">
                      {formatRupiah(item.harga_jual)}
                    </td>
                    <td className="px-4 py-3">{item.stok}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => onEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="remove"
                          onClick={() => onDelete(item)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {Object.keys(groupedData).length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Belum ada data supplier produk</p>
        </Card>
      )}
    </div>
  );
}
