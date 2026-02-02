"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search, Calendar, FileText } from "lucide-react";
import PembelianTable from "@/components/pembelian/pembelianTabel";
import { Pembelian } from "@/app/types/pembelian";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { getAllPembelian } from "@/app/services/pembelian.service";

export default function PembelianPage() {
  const router = useRouter();
  const [pembelianData, setPembelianData] = useState<Pembelian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const allPembelian = await getAllPembelian();

      // Filter by date range if specified
      let filteredPembelian = allPembelian;
      if (startDate) {
        filteredPembelian = filteredPembelian.filter(
          (p) => new Date(p.tanggal) >= new Date(startDate),
        );
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredPembelian = filteredPembelian.filter(
          (p) => new Date(p.tanggal) <= end,
        );
      }

      setPembelianData(filteredPembelian);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching pembelian:", err);
      setError("Gagal memuat data pembelian.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [startDate, endDate]); // Re-run when date filters change

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Daftar Pembelian</h1>
        <Button
          onClick={() =>
            router.push("/dashboard/admin/transaksi/pembelian/tambah")
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Pembelian
        </Button>
      </div>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filter Data Pembelian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search" className="mb-1 block">
                Cari
              </Label>
              <Input
                id="search"
                placeholder="Cari invoice, supplier, dll."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="startDate" className="mb-1 block">
                Tanggal Mulai
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="mb-1 block">
                Tanggal Akhir
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <PembelianTable
        data={pembelianData}
        searchTerm={searchTerm}
        startDate={startDate}
        endDate={endDate}
        refreshData={refreshData}
      />
    </div>
  );
}
