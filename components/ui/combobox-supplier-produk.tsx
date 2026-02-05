"use client";
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { SupplierProduk } from "@/app/types/supplier";
import { Produk } from "@/app/types/produk";

type ProdukOption = Pick<Produk, "id" | "nama">;
type SupplierProdukOption = Pick<
  SupplierProduk,
  "id" | "supplier_id" | "produk_id" | "harga_jual" | "stok"
> & { produk?: ProdukOption | ProdukOption[] };

interface ComboboxSupplierProdukProps {
  supplierProdukList: SupplierProdukOption[];
  produkList: ProdukOption[]; // Keep for now to avoid breaking changes, but logic will prefer nested object
  value: string;
  onChange: (value: string) => void;
}

export function ComboboxSupplierProduk({
  supplierProdukList,
  produkList,
  value,
  onChange,
}: ComboboxSupplierProdukProps) {
  type SupplierProdukWithProduk = SupplierProdukOption & { produk?: ProdukOption | ProdukOption[] };
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Memoize the list with product data included for performance
  const productsWithData = React.useMemo(() => {
    return supplierProdukList.map((sp) => {
      // Prioritize the nested 'produk' object if it exists from the join
      const produk =
        (sp as SupplierProdukWithProduk).produk ||
        produkList.find((p) => p.id === sp.produk_id);
      return {
        ...sp,
        produk: produk,
      };
    });
  }, [supplierProdukList, produkList]);

  const selectedItem = productsWithData.find((item) => item.id === value);

  const filteredItems = React.useMemo(() => {
    if (!search) return productsWithData;
    return productsWithData.filter((item) =>
      (Array.isArray(item.produk) ? item.produk[0] : item.produk)?.nama
        ?.toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [productsWithData, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 border-2"
        >
          {selectedItem
            ? (Array.isArray(selectedItem.produk)
                ? selectedItem.produk[0]
                : selectedItem.produk
              )?.nama || "Produk tidak valid"
            : "Pilih Produk"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Cari produk..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  disabled={item.stok === 0}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex justify-between items-center w-full">
                    <span>
                      {(Array.isArray(item.produk)
                        ? item.produk[0]
                        : item.produk
                      )?.nama || "Produk tidak ditemukan"}
                    </span>
                    <Badge
                      variant={
                        item.stok > 10
                          ? "default"
                          : item.stok > 0
                            ? "outline"
                            : "destructive"
                      }
                      className="ml-2"
                    >
                      Stok: {item.stok}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
