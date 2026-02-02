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
import { Produk } from "@/app/types/produk";

interface ComboboxProdukProps {
  produkList: Produk[];
  value: string;
  onChange: (value: string) => void;
}

export function ComboboxProduk({
  produkList,
  value,
  onChange,
}: ComboboxProdukProps) {
  const [open, setOpen] = React.useState(false);

  const selectedProduk = produkList.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value && selectedProduk ? selectedProduk.nama : "Pilih Produk"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command
          filter={(value, search) => {
            const B = produkList.find((p) => p.id === value);
            if (B?.nama.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="Cari produk..." />
          <CommandList>
            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {produkList.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  disabled={p.stok === 0}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex justify-between items-center w-full">
                    <span>{p.nama}</span>
                    <Badge
                      variant={p.stok > 0 ? "outline" : "destructive"}
                      className="ml-2"
                    >
                      Stok: {p.stok}
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
