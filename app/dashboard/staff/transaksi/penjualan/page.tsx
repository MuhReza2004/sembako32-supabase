"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Penjualan } from "@/app/types/penjualan";
import PenjualanTabel from "@/components/penjualan/PenjualanTabel";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import { supabase } from "@/app/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelPenjualan as serviceCancelPenjualan,
  getAllPenjualan,
} from "@/app/services/penjualan.service";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useStatus } from "@/components/ui/StatusProvider";

export default function StaffPenjualanPage() {
  const router = useRouter();
  const [data, setData] = useState<Penjualan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogDetailOpen, setDialogDetailOpen] = useState(false);
  const [selectedPenjualan, setSelectedPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [cancelingTransaction, setCancelingTransaction] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const confirm = useConfirm();
  const { showStatus } = useStatus();

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const allData = await getAllPenjualan();

      let filteredData = allData;
      if (startDate && endDate) {
        filteredData = allData.filter((item) => {
          const itemDate = new Date(item.tanggal);
          const start = new Date(startDate);
          const end = new Date(endDate);
          return itemDate >= start && itemDate <= end;
        });
      }

      if (searchTerm) {
        filteredData = filteredData.filter(
          (item) =>
            item.no_invoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.namaPelanggan
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()),
        );
      }

      const from = page * perPage;
      const to = from + perPage;
      const paginatedData = filteredData.slice(from, to);

      setData(paginatedData);
      setTotalCount(filteredData.length);
    } catch (err: unknown) {
      console.error("Error fetching sales:", err);
      showStatus({
        message:
          "Gagal memuat data penjualan: " +
          (err instanceof Error ? err.message : "Unknown error"),
        success: false,
      });
      setData([]);
    }
    setIsLoading(false);
  }, [page, perPage, startDate, endDate, searchTerm, showStatus]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("penjualan-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penjualan",
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const handleViewDetails = (penjualan: Penjualan) => {
    setSelectedPenjualan(penjualan);
    setDialogDetailOpen(true);
  };

  const handleCancel = async (id: string) => {
    const confirmed = await confirm({
      title: "Konfirmasi Pembatalan Transaksi",
      message:
        "Apakah Anda yakin ingin membatalkan transaksi ini? Status akan diubah menjadi 'Batal' dan stok produk akan dikembalikan.",
      confirmText: "Batalkan",
      cancelText: "Tidak",
    });

    if (!confirmed) {
      return;
    }

    setCancelingTransaction(id);
    try {
      await serviceCancelPenjualan(id);
      showStatus({
        message:
          "Transaksi berhasil dibatalkan. Status diubah menjadi 'Batal' dan stok telah dikembalikan.",
        success: true,
        refresh: true,
      });
    } catch (error: unknown) {
      console.error("Error canceling transaction:", error);
      showStatus({
        message:
          "Gagal membatalkan transaksi: " +
          (error instanceof Error ? error.message : "Unknown error"),
        success: false,
      });
    } finally {
      setCancelingTransaction(null);
    }
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Transaksi Penjualan
        </h1>
        <Button
          onClick={() =>
            router.push("/dashboard/staff/transaksi/penjualan/tambah")
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Buat Penjualan
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-1/3">
          <Label htmlFor="search">Cari (Invoice / Pelanggan)</Label>
          <Input
            id="search"
            placeholder="Ketik untuk mencari..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-1/4">
          <Label htmlFor="startDate">Tanggal Mulai</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="w-1/4">
          <Label htmlFor="endDate">Tanggal Akhir</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <PenjualanTabel
        data={data}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
        onCancel={handleCancel}
        cancelingTransaction={cancelingTransaction}
      />

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPrev}
          disabled={page === 0 || isLoading}
        >
          Sebelumnya
        </Button>
        <span className="text-sm">Halaman {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchNext}
          disabled={!hasNextPage || isLoading}
        >
          Berikutnya
        </Button>
      </div>

      <DialogDetailPenjualan
        open={dialogDetailOpen}
        onOpenChange={setDialogDetailOpen}
        penjualan={selectedPenjualan}
      />
    </div>
  );
}
