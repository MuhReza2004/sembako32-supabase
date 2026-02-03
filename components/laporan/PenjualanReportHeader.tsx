"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface PenjualanReportHeaderProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export function PenjualanReportHeader({
  onExportPDF,
  onExportExcel,
}: PenjualanReportHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-gray-900">Laporan Penjualan</h1>
      <div className="flex gap-2">
        <Button onClick={onExportPDF} variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
        <Button onClick={onExportExcel} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </div>
    </div>
  );
}
