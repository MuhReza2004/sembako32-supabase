"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteSupplier,
  updateSupplier,
} from "@/app/services/supplier.service";
import TabelSupplier from "@/components/supplier/TabelSupplier";
import DialogTambahSupplier from "@/components/supplier/DialogTambahSupplier";
import EditSupplierDialog from "@/components/supplier/EditSupplierDialog";
// import { DialogHapusSupplier } from "@/components/supplier/DialogHapusSupplier"; // No longer needed
import { Supplier } from "@/app/types/supplier";
import { Search } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null); // No longer needed
  // const [success, setSuccess] = useState<string | null>(null); // No longer needed

  const confirm = useConfirm();
  const { showStatus } = useStatus();

  const [dialogTambahOpen, setDialogTambahOpen] = useState(false);
  const [dialogEditOpen, setDialogEditOpen] = useState(false);
  // const [dialogHapusOpen, setDialogHapusOpen] = useState(false); // No longer needed
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    // setError(null); // No longer needed

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("suppliers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (searchTerm) {
      queryBuilder = queryBuilder.or(
        `kode.ilike.%${searchTerm}%,nama.ilike.%${searchTerm}%,telp.ilike.%${searchTerm}%`,
      );
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      showStatus({
        message: "Gagal memuat data supplier: " + error.message,
        success: false,
      });
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    } else {
      setSuppliers(data as Supplier[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, searchTerm, showStatus]);

  useEffect(() => {
    fetchSuppliers();

    const channel = supabase
      .channel("suppliers-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suppliers",
        },
        () => fetchSuppliers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSuppliers]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

  // const showSuccess = (message: string) => { // No longer needed
  //   setSuccess(message);
  //   setTimeout(() => setSuccess(null), 3000);
  // };

  const handleEditClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogEditOpen(true);
  };

  const handleDeleteClick = async (supplier: Supplier) => {
    const confirmed = await confirm({
      title: "Konfirmasi Hapus",
      message: `Apakah Anda yakin ingin menghapus supplier "${supplier.nama}"?`,
      confirmText: "Hapus",
      cancelText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteSupplier(supplier.id);
      showStatus({
        message: "Supplier berhasil dihapus",
        success: true,
        refresh: true,
      });
      // setDialogHapusOpen(false); // No longer needed
      setSelectedSupplier(null);
    } catch (err: unknown) {
      showStatus({
        message:
          "Gagal menghapus supplier: " +
          (err instanceof Error ? err.message : "Unknown error"),
        success: false,
      });
      console.error("Error deleting supplier:", err);
    } finally {
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manajemen Supplier</h1>
        <Button variant={"primary"} onClick={() => setDialogTambahOpen(true)}>
          + Tambah Supplier
        </Button>
      </div>

      <div className="bg-white p-6 rounded-lg border space-y-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Cari kode, nama, atau telepon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* {error && ( // No longer needed
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && ( // No longer needed
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )} */}

      <TabelSupplier
        data={suppliers}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || isLoading}>
          Previous
        </Button>
        <Button onClick={fetchNext} disabled={!hasNextPage || isLoading}>
          Next
        </Button>
      </div>

      <DialogTambahSupplier
        open={dialogTambahOpen}
        onOpenChange={setDialogTambahOpen}
        // onSuccess={fetchSuppliers} // Replaced with onStatusReport
        onStatusReport={showStatus}
      />

      <EditSupplierDialog
        open={dialogEditOpen}
        onOpenChange={setDialogEditOpen}
        supplier={selectedSupplier}
        onSave={async (supplierData) => {
          try {
            await updateSupplier(supplierData.id, supplierData);
            showStatus({
              message: "Supplier berhasil diupdate",
              success: true,
              refresh: true,
            });
            // fetchSuppliers(); // Handled by refresh: true
            setDialogEditOpen(false);
          } catch (err: unknown) {
            showStatus({
              message:
                "Gagal mengupdate supplier: " +
                (err instanceof Error ? err.message : "Unknown error"),
              success: false,
            });
            console.error("Error updating supplier:", err);
          }
        }}
      />

      {/* <DialogHapusSupplier // No longer needed
        open={dialogHapusOpen}
        onOpenChange={setDialogHapusOpen}
        supplier={selectedSupplier}
        onConfirm={handleDeleteConfirm}
      /> */}
    </div>
  );
}
