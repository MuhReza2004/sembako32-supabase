"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTambahProduk } from "@/components/produk/DialogTambahProduk";
import { DialogEditProduk } from "@/components/produk/DialogEditProduk";
import { DialogHapusProduk } from "@/components/produk/DialogHapusProduk";

import { TabelProduk } from "@/components/produk/TabelProduk";
import {
  updateProduk,
  deleteProduk,
} from "@/app/services/produk.service";
import { Produk, ProdukFormData } from "@/app/types/produk";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client

export default function ProdukAdminPage() {
  const [products, setProducts] = useState<Produk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [dialogTambahOpen, setDialogTambahOpen] = useState(false);
  const [dialogEditOpen, setDialogEditOpen] = useState(false);
  const [dialogHapusOpen, setDialogHapusOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Produk | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // For pagination control

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("produk")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (searchTerm) {
      queryBuilder = queryBuilder.or(
        `kode.ilike.%${searchTerm}%,nama.ilike.%${searchTerm}%`
      );
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      setError("Gagal memuat data produk");
      console.error("Error fetching products:", error);
      setProducts([]);
    } else {
      setProducts(data as Produk[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, searchTerm]);

  // Load produk in real-time with pagination
  useEffect(() => {
    fetchProducts();

    // Supabase real-time listener for changes in 'produk' table
    const channel = supabase
      .channel("produk-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "produk",
        },
        () => {
          fetchProducts(); // Re-fetch the current page on any change
        },
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

  // Show success message
  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

    const checkDuplicateProduct = async (nama: string): Promise<boolean> => {
    if (!nama) return false;
    const { data, error } = await supabase
      .from("produk")
      .select("id")
      .ilike("nama", nama.trim()) // Case-insensitive search for exact match
      .maybeSingle();

    if (error) {
      console.error("Error checking for duplicate product:", error);
      return true; // Assume duplicate to prevent creation on error
    }
    return !!data;
  };

  

  // Handle edit produk
  const handleEditSubmit = async (data: ProdukFormData) => {
    if (!selectedProduct) return;

    // Optional: check duplicate name only if name changed AND is not current product
    if (data.nama !== selectedProduct.nama) {
      const isDuplicate = await checkDuplicateProduct(data.nama);
      if (isDuplicate) {
        setError("Produk dengan nama yang sama sudah terdaftar");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await updateProduk(selectedProduct.id, data);
      showSuccess("Produk berhasil diupdate");
      setDialogEditOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      setError("Gagal mengupdate produk");
      console.error("Error updating product:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit produk (button click)
  const handleEditClick = (product: Produk) => {
    setSelectedProduct(product);
    setDialogEditOpen(true);
  };

  // Handle delete produk
  const handleDeleteClick = (product: Produk) => {
    setSelectedProduct(product);
    setDeletingId(product.id);
    setDialogHapusOpen(true);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    try {
      setIsSubmitting(true);
      await deleteProduk(selectedProduct.id);
      showSuccess("Produk berhasil dihapus");
      setDialogHapusOpen(false);
      setSelectedProduct(null);
      setDeletingId(null);
    } catch (err) {
      setError("Gagal menghapus produk");
      console.error("Error deleting product:", err);
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manajemen Produk</h1>
        <p className="mt-2 text-gray-600">
          Kelola produk, harga, stok, dan status di sini
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
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Cari ID, kode, atau nama produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tombol Tambah */}
          <Button
            onClick={() => {
              setSelectedProduct(null);
              setDialogTambahOpen(true);
            }}
            variant="primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Produk
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <TabelProduk
        products={products}
        isLoading={isLoading}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        deletingId={deletingId}
      />

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || isLoading}>
          Previous
        </Button>
        <Button onClick={fetchNext} disabled={!hasNextPage || isLoading}>
          Next
        </Button>
      </div>

      {/* Dialog Tambah */}
      <DialogTambahProduk
        open={dialogTambahOpen}
        onOpenChange={setDialogTambahOpen}
        onProductAdded={fetchProducts}
        isLoading={isSubmitting}
      />

      {/* Dialog Edit */}
      <DialogEditProduk
        open={dialogEditOpen}
        onOpenChange={setDialogEditOpen}
        onSubmit={handleEditSubmit}
        produk={selectedProduct}
        isLoading={isSubmitting}
      />

      {/* Dialog Hapus */}
      <DialogHapusProduk
        open={dialogHapusOpen}
        onOpenChange={setDialogHapusOpen}
        onConfirm={handleDeleteConfirm}
        produk={selectedProduct}
        isLoading={isSubmitting}
      />
    </div>
  );
}
