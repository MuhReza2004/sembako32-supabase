"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTambahPelanggan } from "@/components/pelanggan/DialogTambahPelanggan";
import { DialogEditPelanggan } from "@/components/pelanggan/DialogEditPelanggan";
import { DialogHapusPelanggan } from "@/components/pelanggan/DialogHapusPelanggan";
import { TabelPelanggan } from "@/components/pelanggan/TabelPelanggan";
import { Pelanggan, PelangganFormData } from "@/app/types/pelanggan";
import { Plus, Search } from "lucide-react";
import {
  addpelanggan,
  deletePelanggan,
  updatePelanggan,
} from "@/app/services/pelanggan.service";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client

export default function PelangganAdminPage() {
  const [customers, setCustomers] = useState<Pelanggan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogTambahOpen, setDialogTambahOpen] = useState(false);
  const [dialogEditOpen, setDialogEditOpen] = useState(false);
  const [dialogHapusOpen, setDialogHapusOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Pelanggan | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // For pagination control


  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("pelanggan")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (searchTerm) {
        queryBuilder = queryBuilder.or(
            `id_pelanggan.ilike.%${searchTerm}%,kode_pelanggan.ilike.%${searchTerm}%,nama_pelanggan.ilike.%${searchTerm}%,no_telp.ilike.%${searchTerm}%`
        );
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      setError("Gagal memuat data pelanggan");
      console.error("Error fetching customers:", error);
      setCustomers([]);
    } else {
      setCustomers(data as Pelanggan[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, searchTerm]);


  // Load pelanggan in real-time with pagination
  useEffect(() => {
    fetchCustomers();

    // Supabase real-time listener for changes in 'pelanggan' table
    const channel = supabase
      .channel("pelanggan-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pelanggan",
        },
        (payload) => {
          fetchCustomers(); // Re-fetch the current page on any change
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCustomers]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };
  
  const hasNextPage = (page + 1) * perPage < totalCount;


  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const checkDuplicateNIB = async (nib: string): Promise<boolean> => {
    if (!nib) return false;
    const { data, error } = await supabase
      .from("pelanggan")
      .select("id")
      .eq("nib", nib.trim())
      .maybeSingle();
    
    if (error) {
        console.error("Error checking duplicate NIB:", error);
        return true; // Assume duplicate on error
    }
    return !!data;
  };

  const handleTambahSubmit = async (data: PelangganFormData) => {
    // Only check for duplicate NIB if it's provided
    if (data.nib) {
      const isDuplicate = await checkDuplicateNIB(data.nib);
      if (isDuplicate) {
        setError(`NIB sudah terdaftar.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await addpelanggan(data);
      showSuccess("Pelanggan berhasil ditambahkan");
      setDialogTambahOpen(false);
      setError(null);
    } catch (err) {
      setError("Gagal menambah pelanggan");
      console.error("Error adding customer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: PelangganFormData) => {
    if (!selectedCustomer || !selectedCustomer.id) return;

    // A new object is created with only the properties of `PelangganFormData`
    const cleanData: Partial<PelangganFormData> = {
      nama_pelanggan: data.nama_pelanggan,
      kode_pelanggan: data.kode_pelanggan,
      nama_toko: data.nama_toko,
      nib: data.nib,
      alamat: data.alamat,
      no_telp: data.no_telp,
      email: data.email,
      status: data.status,
    };

    // Only check for duplicate NIB if it's provided AND changed
    if (data.nib && data.nib !== selectedCustomer.nib) {
        const isDuplicate = await checkDuplicateNIB(data.nib);
        if (isDuplicate) {
            setError(`NIB sudah terdaftar.`);
            return;
        }
    }

    try {
      setIsSubmitting(true);
      await updatePelanggan(selectedCustomer.id, cleanData);
      showSuccess("Pelanggan berhasil diperbarui");
      setDialogEditOpen(false);
      setSelectedCustomer(null);
    } catch (err) {
      setError("Gagal memperbarui pelanggan");
      console.error("Error updating customer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (customer: Pelanggan) => {
    setSelectedCustomer(customer);
    setDialogEditOpen(true);
  };

  const handleDeleteClick = (customer: Pelanggan) => {
    setSelectedCustomer(customer);
    setDialogHapusOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;

    try {
      setIsSubmitting(true);
      await deletePelanggan(selectedCustomer.id);
      showSuccess("Pelanggan berhasil dihapus");
      setDialogHapusOpen(false);
      setSelectedCustomer(null);
    } catch (err) {
      setError("Gagal menghapus pelanggan");
      console.error("Error deleting customer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Manajemen Pelanggan
        </h1>
        <p className="mt-2 text-gray-600">
          Kelola daftar pelanggan dan informasi kontak mereka
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Search & Button Bar */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <div className="flex gap-4 items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Cari ID, kode, nama, atau nomor telepon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            onClick={() => {
              setSelectedCustomer(null);
              setDialogTambahOpen(true);
            }}
            variant={"primary"}
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Pelanggan
          </Button>
        </div>
      </div>

      <TabelPelanggan
        customers={customers}
        isLoading={isLoading}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        searchTerm={searchTerm}
      />

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || isLoading}>
          Previous
        </Button>
        <Button onClick={fetchNext} disabled={!hasNextPage || isLoading}>
          Next
        </Button>
      </div>

      <DialogTambahPelanggan
        open={dialogTambahOpen}
        onOpenChange={setDialogTambahOpen}
        onSubmit={handleTambahSubmit}
        isLoading={isSubmitting}
      />

      <DialogEditPelanggan
        open={dialogEditOpen}
        onOpenChange={setDialogEditOpen}
        onSubmit={handleEditSubmit}
        pelanggan={selectedCustomer}
        isLoading={isSubmitting}
      />

      <DialogHapusPelanggan
        open={dialogHapusOpen}
        onOpenChange={setDialogHapusOpen}
        onConfirm={handleDeleteConfirm}
        pelanggan={selectedCustomer}
        isLoading={isSubmitting}
      />
    </div>
  );
}
