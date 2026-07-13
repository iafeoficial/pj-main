// Exportação de dados para CSV (separador ";" — compatível com Excel pt-BR).

function escape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(escape).join(";")];
  for (const row of rows) lines.push(row.map(escape).join(";"));
  const csv = "﻿" + lines.join("\n"); // BOM p/ acentuação no Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
