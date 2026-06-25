import { formatCurrency } from "@/lib/utils/currency";

interface CreditCardVisualProps {
  nombre: string;
  institucion: string | null;
  color: string;
  limite: number;
  disponible: number;
}

export function CreditCardVisual({ nombre, institucion, color, limite, disponible }: CreditCardVisualProps) {
  return (
    <div
      className="relative flex aspect-[16/9.5] w-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklch, ${color}, black 35%) 100%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">{institucion || "Tarjeta de crédito"}</p>
          <p className="font-heading text-lg font-medium">{nombre}</p>
        </div>
        <div className="h-6 w-9 rounded bg-white/25" />
      </div>
      <div>
        <p className="text-xs text-white/70">Disponible</p>
        <p className="text-mono-amount text-2xl font-semibold">{formatCurrency(disponible)}</p>
        <p className="mt-1 text-xs text-white/70">Límite {formatCurrency(limite)}</p>
      </div>
    </div>
  );
}
