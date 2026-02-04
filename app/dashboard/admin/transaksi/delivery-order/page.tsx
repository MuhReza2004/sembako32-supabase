"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useStatus } from "@/components/ui/StatusProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, formatTanggal } from "@/helper/format";
import { Badge } from "@/components/ui/badge";
import { FileText, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DOStatus = "Draft" | "Dikirim" | "Diterima" | "Batal";

type DeliveryOrderRow = {
  id: string;
  no_do: string;
  no_tanda_terima?: string;
  status: DOStatus;
  tanggal_kirim?: string;
  tanggal_terima?: string;
  created_at: string;
  penjualan: {
    id: string;
    no_invoice: string;
    no_npb: string;
    tanggal: string;
    pelanggan?: { nama_pelanggan?: string; alamat?: string } | null;
    items?: any[];
  };
};

export default function DeliveryOrderPage() {
  const { showStatus } = useStatus();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DeliveryOrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DOStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DeliveryOrderRow | null>(null);
  const [dateMode, setDateMode] = useState<"hari" | "periode">("hari");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchDO = useCallback(async () => {
    setLoading(true);
    const from = page * perPage;
    const to = from + perPage - 1;
    let query = supabase
      .from("delivery_orders")
      .select(
        `
        id,
        no_do,
        no_tanda_terima,
        status,
        tanggal_kirim,
        tanggal_terima,
        created_at,
        penjualan:penjualan_id (
          id,
          no_invoice,
          no_npb,
          tanggal,
          pelanggan:pelanggan_id (
            nama_pelanggan,
            alamat
          ),
          items:penjualan_detail (
            id,
            qty,
            harga,
            subtotal,
            supplier_produk:supplier_produk_id (
              produk:produk_id (
                nama,
                satuan
              )
            )
          )
        )
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (dateMode === "hari" && singleDate) {
      query = query.eq("penjualan.tanggal", singleDate);
    }
    if (dateMode === "periode") {
      if (startDate) query = query.gte("penjualan.tanggal", startDate);
      if (endDate) query = query.lte("penjualan.tanggal", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      showStatus({
        message: "Gagal memuat Delivery Order: " + error.message,
        success: false,
      });
      setRows([]);
    } else {
      setRows(data as DeliveryOrderRow[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [
    page,
    perPage,
    showStatus,
    statusFilter,
    dateMode,
    singleDate,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchDO();
  }, [fetchDO]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.no_do?.toLowerCase().includes(q) ||
        r.penjualan?.no_invoice?.toLowerCase().includes(q) ||
        r.penjualan?.pelanggan?.nama_pelanggan?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const updateStatus = async (row: DeliveryOrderRow, status: DOStatus) => {
    const payload: any = { status };
    if (status === "Dikirim") {
      payload.tanggal_kirim =
        row.tanggal_kirim || new Date().toISOString().split("T")[0];
    }
    if (status === "Diterima") {
      payload.tanggal_terima =
        row.tanggal_terima || new Date().toISOString().split("T")[0];
    }

    const { error } = await supabase
      .from("delivery_orders")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      showStatus({
        message: "Gagal memperbarui status DO: " + error.message,
        success: false,
      });
      return;
    }

    showStatus({
      message: "Status DO berhasil diperbarui.",
      success: true,
      refresh: true,
    });
    fetchDO();
  };

  const handleOpenDetail = (row: DeliveryOrderRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setSelectedRow(null);
    setDetailOpen(false);
  };

  const handlePrintDO = async (row: DeliveryOrderRow) => {
    try {
      const response = await fetch("/api/generate-delivery-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryOrder: row,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      showStatus({
        message: "Gagal membuat PDF DO: " + (err?.message || "Unknown error"),
        success: false,
      });
    }
  };

  const handlePrintBAST = async (row: DeliveryOrderRow) => {
    try {
      const response = await fetch("/api/generate-bast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryOrder: row,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      showStatus({
        message:
          "Gagal membuat PDF Berita Acara: " +
          (err?.message || "Unknown error"),
        success: false,
      });
    }
  };

  const renderStatus = (status: DOStatus) => {
    const map: Record<DOStatus, string> = {
      Draft: "bg-slate-100 text-slate-800",
      Dikirim: "bg-blue-100 text-blue-800",
      Diterima: "bg-green-100 text-green-800",
      Batal: "bg-red-100 text-red-800",
    };
    return <Badge className={map[status]}>{status}</Badge>;
  };

  const hasNextPage = (page + 1) * perPage < totalCount;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Delivery Order</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari No DO / Invoice / Pelanggan"
          className="max-w-sm"
        />
        <Select
          value={dateMode}
          onValueChange={(v) => {
            setDateMode(v as "hari" | "periode");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Mode tanggal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hari">Per Hari</SelectItem>
            <SelectItem value="periode">Per Periode</SelectItem>
          </SelectContent>
        </Select>
        {dateMode === "hari" ? (
          <Input
            type="date"
            value={singleDate}
            onChange={(e) => {
              setSingleDate(e.target.value);
              setPage(0);
            }}
          />
        ) : (
          <>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </>
        )}
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as DOStatus | "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Dikirim">Dikirim</SelectItem>
            <SelectItem value="Diterima">Diterima</SelectItem>
            <SelectItem value="Batal">Batal</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchDO} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="bg-white border rounded-lg">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">
            Memuat data...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Order</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.no_do}</TableCell>
                  <TableCell>{row.penjualan?.no_invoice || "-"}</TableCell>
                  <TableCell>
                    {row.penjualan?.pelanggan?.nama_pelanggan || "-"}
                  </TableCell>
                  <TableCell>
                    {formatTanggal(row.penjualan?.tanggal || row.created_at)}
                  </TableCell>
                  <TableCell>{renderStatus(row.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="w-4 h-4 mr-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Dokumen</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleOpenDetail(row)}
                          >
                            Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrintDO(row)}>
                            Cetak DO
                          </DropdownMenuItem>
                          {row.status === "Diterima" && (
                            <DropdownMenuItem
                              onClick={() => handlePrintBAST(row)}
                            >
                              Cetak Tanda Terima
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {row.status === "Draft" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(row, "Dikirim")}
                        >
                          Kirim
                        </Button>
                      )}
                      {row.status === "Dikirim" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(row, "Diterima")}
                        >
                          Terima
                        </Button>
                      )}
                      {row.status !== "Batal" && row.status !== "Diterima" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus(row, "Batal")}
                        >
                          Batal
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm">
                    Tidak ada data Delivery Order
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex justify-end gap-4 mt-4">
        <Button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          Previous
        </Button>
        <Button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasNextPage || loading}
        >
          Next
        </Button>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Delivery Order</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">No DO</div>
                  <div className="font-semibold">{selectedRow.no_do}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">No Tanda Terima</div>
                  <div className="font-semibold">
                    {selectedRow.no_tanda_terima || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">No Invoice</div>
                  <div className="font-semibold">
                    {selectedRow.penjualan?.no_invoice || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">No NPB</div>
                  <div className="font-semibold">
                    {selectedRow.penjualan?.no_npb || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pelanggan</div>
                  <div className="font-semibold">
                    {selectedRow.penjualan?.pelanggan?.nama_pelanggan || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Alamat</div>
                  <div className="font-semibold">
                    {selectedRow.penjualan?.pelanggan?.alamat || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-semibold">{selectedRow.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tanggal</div>
                  <div className="font-semibold">
                    {formatTanggal(
                      selectedRow.penjualan?.tanggal || selectedRow.created_at,
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedRow.penjualan?.items || []).map(
                      (item: any, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            {item.supplier_produk?.produk?.nama || "Produk"}
                          </TableCell>
                          <TableCell>{item.qty}</TableCell>
                          <TableCell>{formatRupiah(item.harga)}</TableCell>
                          <TableCell>{formatRupiah(item.subtotal)}</TableCell>
                        </TableRow>
                      ),
                    )}
                    {(selectedRow.penjualan?.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm">
                          Tidak ada item
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDetail}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
