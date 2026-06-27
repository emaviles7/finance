/**
 * Etiqueta con el color configurado (método de pago, línea, etc.) para
 * identificar visualmente de un vistazo. Si no hay color, muestra texto plano.
 */
export function ColorChip({ label, color }: { label: string; color?: string | null }) {
  if (!color) return <span className="text-sm">{label}</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
