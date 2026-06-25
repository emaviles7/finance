import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "d MMM yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: es });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
