export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);

// Tanggal kalender WIB (YYYY-MM-DD). Jangan pakai toISOString() untuk
// "hari ini": itu UTC, sehingga 00:00–07:00 WIB menjadi tanggal kemarin.
export const toDateWIB = (date: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const todayWIB = () => toDateWIB(new Date());

export const formatTanggal = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
