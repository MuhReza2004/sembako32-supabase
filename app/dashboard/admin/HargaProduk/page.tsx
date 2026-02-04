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
// import { DialogHapusHargaProduk } from "@/components/hargaProduk/DialogHapusHargaProduk"; // No longer needed
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";

export default function HargaProdukPage() {
  const [data, setData] = useState<SupplierProduk[]>([]);
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  // const [openDelete, setOpenDelete] = useState(false); // No longer needed
  const [selectedItem, setSelectedItem] = useState<SupplierProduk | null>(null);
  // const [selectedDelete, setSelectedDelete] = useState<SupplierProduk | null>( // No longer needed
  //   null,
  // );
  const [preselectedSupplierId, setPreselectedSupplierId] = useState<
    string | undefined
  >(undefined);

  const confirm = useConfirm();
  const { showStatus } = useStatus();

  const fetchData = useCallback(async () => {
    try {
      const res = await getAllSupplierProduk();
      setData(res);
    } catch (error: any) {
      showStatus({
        message: "Gagal memuat data harga produk: " + error.message,
        success: false,
      });
      console.error("Failed to fetch supplier produk:", error);
    }
  }, [showStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (item: SupplierProduk) => {
    const confirmed = await confirm({
      title: "Konfirmasi Hapus",
      message: `Apakah Anda yakin ingin menghapus harga produk ${item.produkNama} dari supplier ${item.supplierNama}?`,
      confirmText: "Hapus",
      cancelText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteSupplierProduk(item.id);
      showStatus({
        message: "Harga produk berhasil dihapus",
        success: true,
        refresh: true,
      });
      // fetchData(); // Handled by refresh: true
    } catch (error: any) {
      showStatus({
        message: "Gagal menghapus harga produk: " + error.message,
        success: false,
      });
      console.error("Failed to delete supplier produk:", error);
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
        // onSuccess={fetchData} // Replaced with onStatusReport
        onStatusReport={showStatus}
        preselectedSupplierId={preselectedSupplierId}
      />

      <DialogEditHargaProduk
        open={openEdit}
        onOpenChange={setOpenEdit}
        item={selectedItem}
        // onSuccess={fetchData} // Replaced with onStatusReport
        onStatusReport={showStatus}
      />

      {/* <DialogHapusHargaProduk // No longer needed
        open={openDelete}
        onOpenChange={setOpenDelete}
        item={selectedDelete}
        onConfirm={handleConfirmDelete}
        supplierName={selectedDelete?.supplierNama}
        productName={selectedDelete?.produkNama}
      /> */}
    </div>
  );
}
