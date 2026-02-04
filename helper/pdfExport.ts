import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Penjualan } from "@/app/types/penjualan";
import { formatRupiah, formatTanggal } from "./format";

let logoDataUrlPromise: Promise<string | null> | null = null;

const loadLogoDataUrl = async () => {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      try {
        const res = await fetch("/logo.svg");
        if (!res.ok) return null;
        const svgText = await res.text();
        const svgBase64 = btoa(unescape(encodeURIComponent(svgText)));
        const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

        const img = new Image();
        img.src = svgDataUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    })();
  }
  return logoDataUrlPromise;
};

const addLogo = async (pdf: jsPDF, x: number, y: number, widthMm: number) => {
  const dataUrl = await loadLogoDataUrl();
  if (!dataUrl) return;

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
  });
  const ratio = img.height / img.width || 1;
  const heightMm = widthMm * ratio;
  pdf.addImage(dataUrl, "PNG", x, y, widthMm, heightMm);
};

const drawHeader = async (
  pdf: jsPDF,
  {
    title,
    dateText,
  }: { title: string; dateText: string },
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const headerX = 12;
  const headerY = 6;
  const headerHeight = 30;
  const headerWidth = pageWidth - 24;

  // Background (match sales report header)
  pdf.setFillColor(254, 195, 53);
  (pdf as any).roundedRect(
    headerX,
    headerY,
    headerWidth,
    headerHeight,
    3,
    3,
    "F",
  );

  // Logo container
  pdf.setFillColor(255, 255, 255);
  (pdf as any).roundedRect(headerX + 6, headerY + 6, 18, 18, 2, 2, "F");
  await addLogo(pdf, headerX + 8, headerY + 8, 14);

  // Company info (left)
  pdf.setTextColor(16, 40, 83);
  pdf.setFontSize(12);
  pdf.text("SEMBAKO 32", headerX + 28, headerY + 12);

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8.5);
  pdf.text("Alamat : Jl. Soekarno Hatta Pasangkayu", headerX + 28, headerY + 18);
  pdf.text("Kontak : 0821-9030-9333", headerX + 28, headerY + 22.5);
  pdf.text("Email  : sembako32@gmail.com", headerX + 28, headerY + 27);

  // Right side date + title
  const rightX = headerX + headerWidth - 8;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8.5);
  pdf.text("Tanggal Cetak:", rightX, headerY + 12, { align: "right" });
  pdf.setFontSize(9);
  pdf.text(dateText, rightX, headerY + 17, { align: "right" });

  pdf.setTextColor(16, 40, 83);
  pdf.setFontSize(13);
  pdf.text(title, rightX, headerY + 25, { align: "right" });
};

const toText = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  return String(value);
};

const safeTanggal = (value: unknown) => {
  if (!value) return "-";
  try {
    return formatTanggal(String(value));
  } catch {
    return "-";
  }
};

export const exportPiutangTableToPDF = async (piutang: Penjualan[]) => {
  const pdf = new jsPDF("l", "mm", "a4"); // landscape orientation

  await drawHeader(pdf, {
    title: "LAPORAN PIUTANG",
    dateText: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  let yPosition = 50;

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
    const total = item.total_akhir ?? item.total ?? 0;
    const totalDibayar = item.total_dibayar ?? (item as any).totalDibayar ?? 0;
    const sisaUtang = total - totalDibayar;

    // Alternate row colors
    if (index % 2 === 0) {
      pdf.setFillColor(254, 249, 231);
      pdf.rect(14, yPosition - 3, 270, 8, "F");
    }

    const rowData = [
      item.no_invoice ?? (item as any).noInvoice ?? item.nomorInvoice ?? "-",
      safeTanggal(item.tanggal),
      item.namaPelanggan || (item as any).nama_pelanggan || "-",
      formatRupiah(total),
      formatRupiah(totalDibayar),
      formatRupiah(sisaUtang),
      item.status || "-",
    ];

    rowData.forEach((data, colIndex) => {
      pdf.text(toText(data), 16 + colIndex * 38, yPosition + 3);
    });

    yPosition += 8;

    // Add payment history for this item if it exists
    if (item.riwayatPembayaran && item.riwayatPembayaran.length > 0) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Riwayat Pembayaran:", 20, yPosition + 3);

      item.riwayatPembayaran.forEach((payment) => {
        yPosition += 5;
        const metode =
          (payment as any).metodePembayaran ?? payment.metode_pembayaran ?? "-";
        const atasNama =
          (payment as any).atasNama ?? payment.atas_nama ?? "N/A";
        const paymentText = `${safeTanggal(payment.tanggal)} - ${formatRupiah(payment.jumlah)} (${metode}) - ${atasNama}`;
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

  const totalTagihan = piutang.reduce(
    (sum, item) => sum + (item.total_akhir ?? item.total ?? 0),
    0,
  );
  const totalDibayar = piutang.reduce(
    (sum, item) =>
      sum + (item.total_dibayar ?? (item as any).totalDibayar ?? 0),
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

  await drawHeader(pdf, {
    title: "DETAIL PIUTANG",
    dateText: new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  let yPosition = 55;

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

  const invoiceNo =
    piutang.no_invoice ?? (piutang as any).noInvoice ?? piutang.nomorInvoice;
  pdf.text(`No. Invoice: ${toText(invoiceNo)}`, 16, yPosition + 6);
  pdf.text(`Tanggal: ${safeTanggal(piutang.tanggal)}`, 16, yPosition + 12);
  pdf.text(
    `Pelanggan: ${piutang.namaPelanggan || (piutang as any).nama_pelanggan || "-"}`,
    16,
    yPosition + 18,
  );
  pdf.text(`Status: ${piutang.status || "-"}`, 120, yPosition + 18);

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
  const totalTagihan = piutang.total_akhir ?? piutang.total ?? 0;
  const totalDibayar =
    piutang.total_dibayar ?? (piutang as any).totalDibayar ?? 0;
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
    const paymentHeaders = [
      "Tanggal",
      "Jumlah",
      "Metode Pembayaran",
      "Penyetor",
    ];
    paymentHeaders.forEach((header, index) => {
      const xPos =
        index === 0 ? 16 : index === 1 ? 50 : index === 2 ? 100 : 145;
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
      pdf.text(safeTanggal(payment.tanggal), 16, yPosition + 3);
      pdf.text(formatRupiah(payment.jumlah), 50, yPosition + 3);
      pdf.text(
        (payment as any).metodePembayaran ?? payment.metode_pembayaran ?? "-",
        100,
        yPosition + 3,
      );
      const atasNama = (payment as any).atasNama ?? payment.atas_nama ?? "-";
      pdf.text(atasNama, 145, yPosition + 3);

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
    `detail_piutang_${toText(invoiceNo)}_${formatTanggal(new Date().toISOString().split("T")[0])}.pdf`,
  );
};
