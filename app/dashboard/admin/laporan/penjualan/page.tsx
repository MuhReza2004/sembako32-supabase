"use client";

import { useEffect, useState, useCallback } from "react";
import { Penjualan } from "@/app/types/penjualan";
import { supabase } from "@/app/lib/supabase";
import { DialogDetailPenjualan } from "@/components/penjualan/DialogDetailPenjualan";
import * as ExcelJS from "exceljs";
import { formatRupiah } from "@/helper/format";
import { PenjualanReportHeader } from "@/components/penjualan/laporan/PenjualanReportHeader";
import { PenjualanSummaryCards } from "@/components/penjualan/laporan/PenjualanSummaryCards";
import { PenjualanFilter } from "@/components/penjualan/laporan/PenjualanFilter";
import { PenjualanTable } from "@/components/penjualan/laporan/PenjualanTable";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function PenjualanReportPage() {
  const [data, setData] = useState<Penjualan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogDetailOpen, setDialogDetailOpen] = useState(false);
  const [selectedPenjualan, setSelectedPenjualan] = useState<Penjualan | null>(
    null,
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0); // Page index, starts from 0
  const [hasMore, setHasMore] = useState(true);

  const fetchPenjualan = useCallback(async (pageIndex: number, shouldAppend = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from("penjualan")
        .select(`
          *,
          pelanggan:pelanggan_id(*),
          items:penjualan_detail(*, supplier_produk:supplier_produk_id(*, produk:produk_id(*)))
        `)
        .order("tanggal", { ascending: false });

      if (startDate) {
        query = query.gte("tanggal", startDate);
      }
      if (endDate) {
        query = query.lte("tanggal", endDate);
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: penjualanData, error: penjualanError } = await query;

      if (penjualanError) {
        throw penjualanError;
      }

      const formattedData = penjualanData.map(item => ({
        ...item,
        namaPelanggan: item.pelanggan?.nama_pelanggan,
        alamatPelanggan: item.pelanggan?.alamat,
        items: item.items.map((detail: any) => ({
            ...detail,
            namaProduk: detail.supplier_produk?.produk?.nama || "Produk tidak ditemukan",
            hargaJual: detail.harga,
            qty: detail.qty,
        }))
      })) as Penjualan[];
      
      setData(prevData => shouldAppend ? [...prevData, ...formattedData] : formattedData);
      setHasMore(penjualanData.length === PAGE_SIZE);

    } catch (err: any) {
      console.error("Error fetching sales:", err);
      setError("Gagal memuat data penjualan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setPage(0); // Reset page when filters change
    fetchPenjualan(0, false);
  }, [startDate, endDate, fetchPenjualan]);

  const fetchNext = () => {
    if (hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPenjualan(nextPage, false);
    }
  };

  const fetchPrev = () => {
    if (page > 0) {
        const prevPage = page - 1;
        setPage(prevPage);
        fetchPenjualan(prevPage, false);
    }
  };

  const handleViewDetails = (penjualan: Penjualan) => {
    setSelectedPenjualan(penjualan);
    setDialogDetailOpen(true);
  };

  const exportToPDF = async () => {
    const newTab = window.open("", "_blank");
    if (!newTab) {
      alert("Gagal membuka tab baru. Mohon izinkan pop-up untuk situs ini.");
      return;
    }
    newTab.document.write("Menghasilkan laporan PDF, mohon tunggu...");

    try {
      const response = await fetch("/api/generate-sales-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      newTab.location.href = url;
    } catch (error) {
      console.error("Error exporting PDF:", error);
      if (newTab) {
        newTab.document.body.innerHTML = `<pre>Gagal membuat PDF. Silakan periksa konsol untuk detailnya.</pre>`;
      }
      alert("Gagal mengekspor laporan PDF. Silakan coba lagi.");
    }
  };

    const totalSales = data.length;
    const activeSales = data.filter((sale) => sale.status !== "Batal");
    const totalRevenue = activeSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalPajak = activeSales.reduce(
        (sum, sale) => sum + (sale.pajak || 0),
        0,
    );
    const penjualanBersih = totalRevenue - totalPajak;
    const paidSales = data.filter((sale) => sale.status === "Lunas").length;
    const unpaidSales = data.filter(
        (sale) => sale.status === "Belum Lunas",
    ).length;
    const canceledSales = data.filter((sale) => sale.status === "Batal").length;

  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Laporan Penjualan");

      // Set column widths
      worksheet.columns = [
        { width: 5 }, // No
        { width: 18 }, // Invoice
        { width: 18 }, // NPB
        { width: 18 }, // DO
        { width: 20 }, // Metode Pengambilan
        { width: 15 }, // Tanggal
        { width: 25 }, // Pelanggan
        { width: 35 }, // Alamat
        { width: 45 }, // Produk Dibeli
        { width: 18 }, // Total
        { width: 15 }, // Status
      ];

      // Add title
      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "LAPORAN PENJUALAN";
      titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      };
      worksheet.getRow(1).height = 30;

      // Add period info
      worksheet.mergeCells("A2:K2");
      const periodText =
        startDate && endDate
          ? `Periode: ${new Date(startDate).toLocaleDateString("id-ID")} - ${new Date(endDate).toLocaleDateString("id-ID")}`
          : startDate
            ? `Dari: ${new Date(startDate).toLocaleDateString("id-ID")}`
            : endDate
              ? `Sampai: ${new Date(endDate).toLocaleDateString("id-ID")}`
              : "Semua Periode";
      const periodCell = worksheet.getCell("A2");
      periodCell.value = periodText;
      periodCell.font = { size: 11, italic: true };
      periodCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).height = 20;

      // Add spacing
      worksheet.getRow(3).height = 5;

      // Add summary section with better styling
      const summaryStartRow = 4;

      // Summary title
      worksheet.mergeCells(`A${summaryStartRow}:B${summaryStartRow}`);
      const summaryTitleCell = worksheet.getCell(`A${summaryStartRow}`);
      summaryTitleCell.value = "RINGKASAN";
      summaryTitleCell.font = {
        size: 12,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      summaryTitleCell.alignment = { horizontal: "center", vertical: "middle" };
      summaryTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3B82F6" },
      };
      summaryTitleCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      worksheet.getRow(summaryStartRow).height = 25;

      // Summary data
      const summaryData = [
        { label: "Total Penjualan", value: totalSales, format: "number" },
        { label: "Total Pendapatan", value: totalRevenue, format: "currency" },
        { label: "Penjualan Lunas", value: paidSales, format: "number" },
        {
          label: "Penjualan Belum Lunas",
          value: unpaidSales,
          format: "number",
        },
      ];

      summaryData.forEach((item, index) => {
        const rowNum = summaryStartRow + 1 + index;
        const labelCell = worksheet.getCell(`A${rowNum}`);
        const valueCell = worksheet.getCell(`B${rowNum}`);

        labelCell.value = item.label;
        labelCell.font = { bold: true, size: 11 };
        labelCell.alignment = { horizontal: "left", vertical: "middle" };
        labelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };
        labelCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        if (item.format === "currency") {
          valueCell.value = item.value;
          valueCell.numFmt = '"Rp" #,##0';
        } else {
          valueCell.value = item.value;
        }
        valueCell.font = { size: 11 };
        valueCell.alignment = { horizontal: "right", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        worksheet.getRow(rowNum).height = 20;
      });

      // Add spacing
      const dataStartRow = summaryStartRow + summaryData.length + 2;
      worksheet.getRow(dataStartRow - 1).height = 5;

      // Add headers
      const headers = [
        "No",
        "Invoice",
        "No. NPB",
        "No. DO",
        "Metode Pengambilan",
        "Tanggal",
        "Pelanggan",
        "Alamat",
        "Produk Dibeli",
        "Total",
        "Status",
      ];

      const headerRow = worksheet.getRow(dataStartRow);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F2937" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
      headerRow.height = 25;

      // Add data with alternating row colors
      data.forEach((penjualan, index) => {
        const produkDibeli =
          penjualan.items && penjualan.items.length > 0
            ? penjualan.items
                .map(
                  (item) =>
                    `${item.namaProduk} (${item.qty} x ${formatRupiah(item.hargaJual || 0)})`,
                )
                .join("\n")
            : "Tidak ada item";

        const rowData = [
          index + 1,
          penjualan.noInvoice,
          penjualan.noNPB,
          penjualan.noDO || "-",
          penjualan.metodePengambilan,
          new Date(penjualan.tanggal).toLocaleDateString("id-ID"),
          penjualan.namaPelanggan || "Pelanggan Tidak Diketahui",
          penjualan.alamatPelanggan || "-",
          produkDibeli,
          penjualan.total,
          penjualan.status,
        ];

        const row = worksheet.addRow(rowData);
        row.height = 30;

        // Apply alternating row colors
        const fillColor = index % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Alignment
          if (colNumber === 1 || colNumber === 10 || colNumber === 11) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colNumber === 9) {
            cell.alignment = {
              horizontal: "left",
              vertical: "top",
              wrapText: true,
            };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }

          // Fill color
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColor },
          };

          // Border
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };

          // Font
          cell.font = { size: 10 };

          // Format currency
          if (colNumber === 10) {
            cell.numFmt = '"Rp" #,##0';
          }

          // Status styling
          if (colNumber === 11) {
            cell.font = { bold: true, size: 10 };
            if (cell.value === "Lunas") {
              cell.font = { ...cell.font, color: { argb: "FF16A34A" } };
            } else if (cell.value === "Belum Lunas") {
              cell.font = { ...cell.font, color: { argb: "FFDC2626" } };
            } else if (cell.value === "Batal") {
              cell.font = { ...cell.font, color: { argb: "FF6B7280" } };
            }
          }
        });
      });

      // Add footer
      const lastRow = worksheet.rowCount + 2;
      worksheet.mergeCells(`A${lastRow}:K${lastRow}`);
      const footerCell = worksheet.getCell(`A${lastRow}`);
      footerCell.value = `Dicetak pada: ${new Date().toLocaleString("id-ID")}`;
      footerCell.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
      footerCell.alignment = { horizontal: "center", vertical: "middle" };

      // Set print options
      worksheet.pageSetup = {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.5,
          right: 0.5,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3,
        },
      };

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan_penjualan_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Gagal mengekspor laporan Excel. Silakan coba lagi.");
    }
  };

  if (isLoading && page === 0 && data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Memuat data laporan penjualan...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PenjualanReportHeader
        onExportPDF={exportToPDF}
        onExportExcel={exportToExcel}
      />

      <PenjualanSummaryCards
        totalSales={totalSales}
        totalRevenue={totalRevenue}
        totalPajak={totalPajak}
        penjualanBersih={penjualanBersih}
        paidSales={paidSales}
        unpaidSales={unpaidSales}
        canceledSales={canceledSales}
      />

      <PenjualanFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      <PenjualanTable
        data={data}
        onViewDetails={handleViewDetails}
        onExportExcel={exportToExcel}
        isLoading={isLoading}
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
          disabled={!hasMore || isLoading}
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
