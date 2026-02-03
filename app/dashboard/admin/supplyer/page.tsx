"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Supplier } from "@/app/types/suplyer";
import {
  deleteSupplier,
  getAllSuppliers,
  updateSupplier,
} from "@/app/services/supplyer.service";
import SupplierTable from "@/components/suplyer/TabelSuplyer";
import DialogTambahSupplier from "@/components/suplyer/DialogTambahSuplyer";
import EditSupplierDialog from "@/components/suplyer/EditSupplierDialog";
import { DialogHapusSupplier } from "@/components/suplyer/DialogHapusSupplier";

export default function SupplierPage() {
  const [data, setData] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<Supplier | null>(null);
  const fetchData = async () => {
    const res = await getAllSuppliers();
    setData(res);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = (supplier: Supplier) => {
    console.log("handleDelete called with supplier:", supplier);
    setSelectedDelete(supplier);
    setOpenDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDelete) return;
    await deleteSupplier(selectedDelete.id);
    fetchData();
    setSelectedDelete(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelected(supplier);
    setOpenEdit(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manajemen Supplier</h1>
        <Button variant={"primary"} onClick={() => setOpen(true)}>
          + Tambah Supplier
        </Button>
      </div>

      <SupplierTable
        data={data}
        onDetail={handleEdit}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <DialogTambahSupplier
        open={open}
        onOpenChange={setOpen}
        onSuccess={fetchData}
      />

      <EditSupplierDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        supplier={selected}
        onSave={async (supplier) => {
          // update supplier - extract only the form data fields
          const { id, created_at, updated_at, ...supplierData } = supplier;
          await updateSupplier(supplier.id, supplierData);
          fetchData();
        }}
      />

      <DialogHapusSupplier
        open={openDelete}
        onOpenChange={setOpenDelete}
        supplier={selectedDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
