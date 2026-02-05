"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTambahProduk } from "@/components/produk/DialogTambahProduk";
import { DialogEditProduk } from "@/components/produk/DialogEditProduk";

import { TabelProduk } from "@/components/produk/TabelProduk";
import { updateProduk, deleteProduk } from "@/app/services/produk.service";
import { Produk, ProdukFormData } from "@/app/types/produk";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/app/lib/supabase"; // Import Supabase client
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";
import { useDebounce } from "@/hooks/useDebounce";
import { useBatchedRefresh } from "@/hooks/useBatchedRefresh";

export default function ProdukAdminPage() {
  const [products, setProducts] = useState<Produk[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const confirm = useConfirm();
  const { showStatus } = useStatus();

  // Dialog states
  const [dialogTambahOpen, setDialogTambahOpen] = useState(false);
  const [dialogEditOpen, setDialogEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Produk | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [page, setPage] = useState(0); // Supabase range is 0-indexed
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); // For pagination control

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("produk")
      .select("id, kode, nama, kategori, satuan, stok, status, created_at, updated_at", {
        count: "planned",
      })
      .order("created_at", { ascending: false });

    if (debouncedSearch) {
      queryBuilder = queryBuilder.or(
        `kode.ilike.%${debouncedSearch}%,nama.ilike.%${debouncedSearch}%`
      );
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      showStatus({
        message: "Gagal memuat data produk: " + error.message,
        success: false,
      });
      console.error("Error fetching products:", error);
      setProducts([]);
    } else {
      setProducts(data as Produk[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, debouncedSearch, showStatus]);

  const { schedule: scheduleRefresh } = useBatchedRefresh(fetchProducts);

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
          scheduleRefresh(); // Batch refresh on any change
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts, scheduleRefresh]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

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
        showStatus({
          message: "Produk dengan nama yang sama sudah terdaftar",
          success: false,
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await updateProduk(selectedProduct.id, data);
      showStatus({
        message: "Produk berhasil diupdate",
        success: true,
        refresh: true,
      });
      setDialogEditOpen(false);
      setSelectedProduct(null);
    } catch (err: unknown) {
      showStatus({
        message:
          "Gagal mengupdate produk: " +
          (err instanceof Error ? err.message : "Unknown error"),
        success: false,
      });
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
  const handleDeleteClick = async (product: Produk) => {
    const confirmed = await confirm({
      title: "Konfirmasi Hapus",
      message: `Apakah Anda yakin ingin menghapus produk "${product.nama}"?`,
      confirmText: "Hapus",
      cancelText: "Batal",
    });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(product.id);
      setIsSubmitting(true);
      await deleteProduk(product.id);
      showStatus({
        message: "Produk berhasil dihapus",
        success: true,
        refresh: true,
      });
      setSelectedProduct(null);
    } catch (err: unknown) {
      showStatus({
        message:
          "Gagal menghapus produk: " +
          (err instanceof Error ? err.message : "Unknown error"),
        success: false,
      });
      console.error("Error deleting product:", err);
    } finally {
      setIsSubmitting(false);
      setDeletingId(null);
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
        isLoading={isSubmitting}
        onStatusReport={showStatus} // Pass showStatus down
      />

      {/* Dialog Edit */}
      <DialogEditProduk
        open={dialogEditOpen}
        onOpenChange={setDialogEditOpen}
        onSubmit={handleEditSubmit}
        produk={selectedProduct}
        isLoading={isSubmitting}
      />

      {/* Dialog Hapus (This dialog is now controlled by useConfirm directly) */}
      {/* We can remove this dialog as handleDeleteClick directly uses useConfirm now */}
      {/* <DialogHapusProduk
        open={dialogHapusOpen}
        onOpenChange={setDialogHapusOpen}
        onConfirm={handleDeleteConfirm}
        produk={selectedProduct}
        isLoading={isSubmitting}
      /> */}
    </div>
  );
}
