import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Penjualan } from "@/app/types/penjualan";
import { formatRupiah, formatTanggal } from "./format";

export const exportPiutangTableToPDF = async (piutang: Penjualan[]) => {
  const pdf = new jsPDF("l", "mm", "a4"); // landscape orientation

  pdf.setFillColor(16, 40, 83); // Blue header
  pdf.rect(14, 0, 270, 25, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.text("LAPORAN PIUTANG", 16, 18);

  pdf.setFontSize(12);
  pdf.text(
    `Tanggal: ${formatTanggal(new Date().toISOString().split("T")[0])}`,
    200,
    18,
  );

  // Reset text color
  pdf.setTextColor(0, 0, 0);

  let yPosition = 35;

  // Main table headers
  const headers = [
    "No. Invoice",
    "Tanggal",
    "Nama Pelanggan",
    "Total Tagihan",
    "Total Dibayar",
    "Sisa Utang",
    "Status",
  ];

  // Header styling
  pdf.setFontSize(10);
  pdf.setFillColor(16, 40, 83); // Blue header
  pdf.rect(14, yPosition - 3, 270, 10, "F");

  pdf.setTextColor(255, 255, 255);
  headers.forEach((header, index) => {
    pdf.text(header, 16 + index * 38, yPosition + 3);
  });

  pdf.setTextColor(0, 0, 0);
  yPosition += 15;

  // Table data
  piutang.forEach((item, index) => {
    const totalDibayar = item.totalDibayar || 0;
    const sisaUtang = item.total - totalDibayar;

    // Alternate row colors
    if (index % 2 === 0) {
      pdf.setFillColor(254, 249, 231);
      pdf.rect(14, yPosition - 3, 270, 8, "F");
    }

    const rowData = [
      item.noInvoice,
      formatTanggal(item.tanggal),
      item.namaPelanggan || "",
      formatRupiah(item.total),
      formatRupiah(totalDibayar),
      formatRupiah(sisaUtang),
      item.status,
    ];

    rowData.forEach((data, colIndex) => {
      pdf.text(data.toString(), 16 + colIndex * 38, yPosition + 3);
    });

    yPosition += 8;

    // Add payment history for this item if it exists
    if (item.riwayatPembayaran && item.riwayatPembayaran.length > 0) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Riwayat Pembayaran:", 20, yPosition + 3);

      item.riwayatPembayaran.forEach((payment) => {
        yPosition += 5;
        const paymentText = `${formatTanggal(payment.tanggal)} - ${formatRupiah(payment.jumlah)} (${payment.metodePembayaran}) - ${payment.atasNama || "N/A"}`;
        pdf.text(paymentText, 25, yPosition + 3);
      });

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;
    }

    // Add new page if needed
    if (yPosition > 170) {
      pdf.addPage();
      yPosition = 20;
    }
  });

  // Add summary section
  yPosition += 10;
  pdf.setFillColor(16, 40, 83);
  pdf.rect(14, yPosition, 270, 15, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("RINGKASAN KESELURUHAN", 16, yPosition + 10);

  const totalTagihan = piutang.reduce((sum, item) => sum + item.total, 0);
  const totalDibayar = piutang.reduce(
    (sum, item) => sum + (item.totalDibayar || 0),
    0,
  );
  const totalSisa = totalTagihan - totalDibayar;

  yPosition += 20;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);

  pdf.setFillColor(254, 249, 231);
  pdf.rect(14, yPosition, 85, 12, "F");
  pdf.rect(104, yPosition, 85, 12, "F");
  pdf.rect(194, yPosition, 85, 12, "F");

  pdf.text(`Total Tagihan: ${formatRupiah(totalTagihan)}`, 19, yPosition + 8);
  pdf.text(`Total Dibayar: ${formatRupiah(totalDibayar)}`, 109, yPosition + 8);
  pdf.text(`Sisa Utang: ${formatRupiah(totalSisa)}`, 199, yPosition + 8);

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text("Dicetak pada: " + new Date().toLocaleString("id-ID"), 14, 200);

  // Save the PDF
  pdf.save(
    `laporan_piutang_${formatTanggal(new Date().toISOString().split("T")[0])}.pdf`,
  );
};

export const exportPiutangDetailToPDF = async (piutang: Penjualan) => {
  const pdf = new jsPDF("p", "mm", "a4"); // portrait orientation

  // Add header with company branding
  pdf.setFillColor(16, 40, 83); // Blue header
  pdf.rect(14, 0, 180, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text("DETAIL PIUTANG", 16, 20);

  pdf.setFontSize(10);
  pdf.text(
    `Dicetak: ${formatTanggal(new Date().toISOString().split("T")[0])}`,
    140,
    25,
  );

  // Reset text color
  pdf.setTextColor(0, 0, 0);

  let yPosition = 45;

  pdf.setFillColor(16, 40, 83);
  pdf.rect(14, yPosition, 180, 12, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("INFORMASI INVOICE", 16, yPosition + 8);

  pdf.setTextColor(0, 0, 0);
  yPosition += 18;

  // Invoice details
  pdf.setFontSize(11);
  pdf.setFillColor(254, 249, 231);
  pdf.rect(14, yPosition, 180, 25, "F");

  pdf.text(`No. Invoice: ${piutang.noInvoice}`, 16, yPosition + 6);
  pdf.text(`Tanggal: ${formatTanggal(piutang.tanggal)}`, 16, yPosition + 12);
  pdf.text(`Pelanggan: ${piutang.namaPelanggan || ""}`, 16, yPosition + 18);
  pdf.text(`Status: ${piutang.status}`, 120, yPosition + 18);

  yPosition += 35;

  // Financial summary
  pdf.setFillColor(254, 195, 53); // Green header
  pdf.rect(14, yPosition, 180, 12, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("RINGKASAN KEUANGAN", 16, yPosition + 8);

  pdf.setTextColor(0, 0, 0);
  yPosition += 18;

  // Financial details in boxes
  const totalTagihan = piutang.total;
  const totalDibayar = piutang.totalDibayar || 0;
  const sisaUtang = totalTagihan - totalDibayar;

  // Total Tagihan box
  pdf.setFillColor(254, 249, 231);
  pdf.rect(14, yPosition, 55, 15, "F");
  pdf.setFontSize(9);
  pdf.text("Total Tagihan", 16, yPosition + 6);
  pdf.setFontSize(10);
  pdf.text(formatRupiah(totalTagihan), 16, yPosition + 12);

  // Total Dibayar box
  pdf.setFillColor(254, 249, 231);
  pdf.rect(74, yPosition, 55, 15, "F");
  pdf.setFontSize(9);
  pdf.text("Total Dibayar", 76, yPosition + 6);
  pdf.setFontSize(10);
  pdf.text(formatRupiah(totalDibayar), 76, yPosition + 12);

  // Sisa Utang box
  if (sisaUtang > 0) {
    pdf.setFillColor(255, 235, 235);
    pdf.setTextColor(231, 76, 60);
  } else {
    pdf.setFillColor(254, 249, 231);
    pdf.setTextColor(0, 0, 0);
  }
  pdf.rect(134, yPosition, 55, 15, "F");
  pdf.setFontSize(9);
  pdf.text("Sisa Utang", 136, yPosition + 6);
  pdf.setFontSize(10);
  pdf.text(formatRupiah(sisaUtang), 136, yPosition + 12);

  pdf.setTextColor(0, 0, 0);
  yPosition += 30;

  // Payment history section
  pdf.setFillColor(16, 40, 83); // Purple header
  pdf.rect(14, yPosition, 180, 12, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.text("RIWAYAT PEMBAYARAN", 16, yPosition + 8);

  pdf.setTextColor(0, 0, 0);
  yPosition += 18;

  if (piutang.riwayatPembayaran && piutang.riwayatPembayaran.length > 0) {
    // Table headers
    pdf.setFontSize(10);
    pdf.setFillColor(16, 40, 83);
    pdf.rect(14, yPosition, 180, 8, "F");

    pdf.setTextColor(255, 255, 255);
    const paymentHeaders = ["Tanggal", "Jumlah", "Metode Pembayaran"];
    paymentHeaders.forEach((header, index) => {
      const xPos = index === 0 ? 16 : index === 1 ? 50 : 100;
      pdf.text(header, xPos, yPosition + 5);
    });

    pdf.setTextColor(0, 0, 0);
    yPosition += 12;

    // Payment data
    piutang.riwayatPembayaran.forEach((payment, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        pdf.setFillColor(254, 249, 231);
        pdf.rect(14, yPosition - 2, 180, 8, "F");
      }

      pdf.setFontSize(9);
      pdf.text(formatTanggal(payment.tanggal), 16, yPosition + 3);
      pdf.text(formatRupiah(payment.jumlah), 50, yPosition + 3);
      pdf.text(payment.metodePembayaran, 100, yPosition + 3);

      if (payment.atasNama) {
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Atas nama: ${payment.atasNama}`, 16, yPosition + 7);
        pdf.setTextColor(0, 0, 0);
        yPosition += 2;
      }

      yPosition += 8;

      // Add new page if needed
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
    });
  } else {
    pdf.setFillColor(254, 249, 231);
    pdf.rect(14, yPosition, 180, 20, "F");

    pdf.setFontSize(10);
    pdf.text("Belum ada pembayaran tercatat", 16, yPosition + 8);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      "Pembayaran akan muncul di sini setelah dilakukan",
      16,
      yPosition + 14,
    );

    yPosition += 25;
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text("Dokumen ini dihasilkan secara otomatis oleh sistem", 14, 285);
  pdf.text("© 2024 - Sistem Manajemen Gudang", 14, 290);

  // Save the PDF
  pdf.save(
    `detail_piutang_${piutang.noInvoice}_${formatTanggal(new Date().toISOString().split("T")[0])}.pdf`,
  );
};
