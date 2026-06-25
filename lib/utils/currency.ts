export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
