"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { PembelianTabel } from "@/components/pembelian/pembelianTabel";
import { Pembelian } from "@/app/types/pembelian";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function PembelianPage() {
  const router = useRouter();
  const [pembelianData, setPembelianData] = useState<Pembelian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPembelian = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const from = page * perPage;
    const to = from + perPage - 1;

    let queryBuilder = supabase
      .from("pembelian")
      .select(
        `
        *,
        suppliers (nama),
        pembelian_detail (
          qty,
          harga,
          subtotal,
          supplier_produk (
            produk (
              nama
            )
          )
        )
      `,
        { count: "exact" },
      )
      .order("tanggal", { ascending: false });

    if (searchTerm) {
      queryBuilder = queryBuilder.or(
        `invoice.ilike.%${searchTerm}%,no_do.ilike.%${searchTerm}%,suppliers.nama.ilike.%${searchTerm}%`
      );
    }
    if (startDate) {
      queryBuilder = queryBuilder.gte("tanggal", startDate);
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte("tanggal", endDate);
    }

    const { data, error, count } = await queryBuilder.range(from, to);

    if (error) {
      console.error("Error fetching pembelian:", error);
      setError("Gagal memuat data pembelian.");
      setPembelianData([]);
    } else {
      setPembelianData(data as Pembelian[]);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  }, [page, perPage, searchTerm, startDate, endDate]);

  useEffect(() => {
    fetchPembelian();

    const channel = supabase
      .channel("pembelian-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pembelian",
        },
        () => fetchPembelian(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPembelian]);

  const fetchNext = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const fetchPrev = () => {
    setPage((prevPage) => Math.max(0, prevPage - 1));
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

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

      <PembelianTabel data={pembelianData} isLoading={isLoading} />

      <div className="flex justify-end gap-4 mt-4">
        <Button onClick={fetchPrev} disabled={page === 0 || isLoading}>
          Previous
        </Button>
        <Button onClick={fetchNext} disabled={!hasNextPage || isLoading}>
          Next
        </Button>
      </div>
    </div>
  );
}
