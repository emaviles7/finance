"use client";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FileDownIcon, FileSpreadsheetIcon, PrinterIcon } from "lucide-react";

interface ExportButtonsProps {
  filename: string;
  rows: Record<string, string | number>[];
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ filename, rows }: ExportButtonsProps) {
  function exportarCSV() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    descargarBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    descargarBlob(
      new Blob([buffer], { type: "application/octet-stream" }),
      `${filename}.xlsx`
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportarCSV} disabled={rows.length === 0}>
        <FileDownIcon className="size-4" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportarExcel} disabled={rows.length === 0}>
        <FileSpreadsheetIcon className="size-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
        <PrinterIcon className="size-4" />
        PDF
      </Button>
    </div>
  );
}
