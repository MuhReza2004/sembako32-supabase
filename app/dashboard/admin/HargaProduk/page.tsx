"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SupplierProduk } from "@/app/types/supplier";
import {
  deleteSupplierProduk,
  getAllSupplierProduk,
} from "@/app/services/supplierProduk.service";
import TabelHargaProduk from "@/components/hargaProduk/TabelHargaProduk";
import DialogTambahHargaProduk from "@/components/hargaProduk/DialogTambahHargaProduk";
import DialogEditHargaProduk from "@/components/hargaProduk/DialogEditHargaProduk";
import { DialogHapusHargaProduk } from "@/components/hargaProduk/DialogHapusHargaProduk";

export default function HargaProdukPage() {
  const [data, setData] = useState<SupplierProduk[]>([]);
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupplierProduk | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<SupplierProduk | null>(
    null,
  );
  const [preselectedSupplierId, setPreselectedSupplierId] = useState<
    string | undefined
  >(undefined);

  const fetchData = useCallback(async () => {
    const res = await getAllSupplierProduk();
    setData(res);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = (item: SupplierProduk) => {
    setSelectedDelete(item);
    setOpenDelete(true);
  };

  const getSupplierName = (supplierId: string) => {
    // This is a simple fallback - in a real app you'd fetch supplier data
    return supplierId; // For now, just return the ID
  };

  const getProductName = (produkId: string) => {
    // This is a simple fallback - in a real app you'd fetch product data
    return produkId; // For now, just return the ID
  };

  const handleConfirmDelete = async () => {
    if (!selectedDelete) return;
    try {
      await deleteSupplierProduk(selectedDelete.id);
      fetchData();
      setSelectedDelete(null);
    } catch (error) {
      console.error("Failed to delete supplier produk:", error);
      // Optionally, add a user-facing notification here, e.g., a toast
    }
  };

  const handleEdit = (item: SupplierProduk) => {
    setSelectedItem(item);
    setOpenEdit(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manajemen Supplier Produk</h1>
        <Button onClick={() => setOpen(true)}>+ Tambah Supplier Produk</Button>
      </div>

      <TabelHargaProduk
        data={data}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAddProduct={(supplierId) => {
          setPreselectedSupplierId(supplierId);
          setOpen(true);
        }}
      />

      <DialogTambahHargaProduk
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) setPreselectedSupplierId(undefined);
        }}
        onSuccess={fetchData}
        preselectedSupplierId={preselectedSupplierId}
      />

      <DialogEditHargaProduk
        open={openEdit}
        onOpenChange={setOpenEdit}
        item={selectedItem}
        onSuccess={fetchData}
      />

      <DialogHapusHargaProduk
        open={openDelete}
        onOpenChange={setOpenDelete}
        item={selectedDelete}
        onConfirm={handleConfirmDelete}
        supplierName={selectedDelete?.supplierNama}
        productName={selectedDelete?.produkNama}
      />
    </div>
  );
}
