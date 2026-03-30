"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Plus, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pelanggan } from "@/app/types/pelanggan";

type PelangganOption = Pick<
  Pelanggan,
  "id" | "nama_pelanggan" | "kode_pelanggan" | "nama_toko"
>;

interface ComboboxPelangganProps {
  pelangganList: PelangganOption[];
  value: string;
  onChange: (value: string) => void;
  onAddNew?: () => void; // Made optional
}

export function ComboboxPelanggan({
  pelangganList,
  value,
  onChange,
  onAddNew,
}: ComboboxPelangganProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedPelanggan = pelangganList.find((p) => p.id === value);

  const filteredPelanggan = React.useMemo(() => {
    if (!search) return pelangganList;
    return pelangganList.filter(
      (p) =>
        p.nama_pelanggan.toLowerCase().includes(search.toLowerCase()) ||
        p.kode_pelanggan.toLowerCase().includes(search.toLowerCase()) ||
        p.nama_toko?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [pelangganList, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 border-2 gap-2"
        >
          <span className="flex-1 min-w-0 truncate text-left">
            {selectedPelanggan
              ? `${selectedPelanggan.nama_pelanggan} (${selectedPelanggan.kode_pelanggan})`
              : "Pilih Pelanggan"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Cari pelanggan..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {filteredPelanggan.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nama_pelanggan} ${p.kode_pelanggan} ${p.nama_toko || ""}`}
                  onSelect={() => {
                    onChange(p.id === value ? "" : p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-semibold">
                        {p.nama_pelanggan} ({p.kode_pelanggan})
                      </div>
                      <div className="text-xs text-gray-500">{p.nama_toko}</div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {onAddNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Pelanggan Baru
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
