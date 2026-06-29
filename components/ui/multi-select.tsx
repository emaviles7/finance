"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Valores seleccionados. Lista vacía = sin filtro (equivale a "todos"). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Texto mostrado cuando no hay nada seleccionado. */
  placeholder: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: MultiSelectProps) {
  const selectedSet = new Set(selected);

  function toggle(value: string, checked: boolean) {
    if (checked) onChange([...selected, value]);
    else onChange(selected.filter((v) => v !== value));
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} seleccionados`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
          selected.length === 0 && "text-muted-foreground",
          className
        )}
      >
        <span className="line-clamp-1">{label}</span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-auto min-w-(--anchor-width)">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selectedSet.has(opt.value)}
            onCheckedChange={(checked) => toggle(opt.value, checked)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
