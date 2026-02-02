"use client";

import { useEffect, useState } from "react";
import { SupplierProduk } from "@/app/types/suplyer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAllSuppliers } from "@/app/services/supplyer.service";
import { getAllProduk } from "@/app/services/produk.service";
import { Supplier } from "@/app/types/suplyer";
import { Produk } from "@/app/types/produk";
import { formatRupiah } from "@/helper/format";

interface Props {
  data: SupplierProduk[];
  onEdit: (item: SupplierProduk) => void;
  onDelete: (id: string) => void;
  onAddProduct: (supplierId: string) => void;
}

export default function TabelHargaProduk({
  data,
  onEdit,
  onDelete,
  onAddProduct,
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [sups, prods] = await Promise.all([
        getAllSuppliers(),
        getAllProduk(),
      ]);
      setSuppliers(sups);
      setProducts(prods);
    };
    fetchData();
  }, []);

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.nama || supplierId;
  };

  const getProductName = (produkId: string) => {
    const product = products.find((p) => p.id === produkId);
    return product?.nama || produkId;
  };

  // Group data by supplier
  const groupedData = data.reduce(
    (acc, item) => {
      if (!acc[item.supplier_id]) {
        acc[item.supplier_id] = [];
      }
      acc[item.supplier_id].push(item);
      return acc;
    },
    {} as Record<string, SupplierProduk[]>,
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
                          onClick={() => onDelete(item.id)}
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