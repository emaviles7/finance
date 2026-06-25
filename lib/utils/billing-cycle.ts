export interface PeriodoCorte {
  fechaInicio: Date;
  fechaCorte: Date;
  fechaPago: Date;
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

function clampDia(anio: number, mes: number, dia: number): number {
  return Math.min(dia, diasEnMes(anio, mes));
}

/**
 * Calcula el período de facturación vigente (inicio, corte, pago) para una
 * fecha de referencia dada, a partir del día de corte y día de pago de la
 * tarjeta. Maneja meses con menos días (clamping) y el caso en que el pago
 * cae en el mes siguiente al corte.
 */
export function calcularPeriodoCorte(
  diaCorte: number,
  diaPago: number,
  fechaRef: Date = new Date()
): PeriodoCorte {
  const y = fechaRef.getFullYear();
  const m = fechaRef.getMonth();
  const d = fechaRef.getDate();

  const corteEsteMesDia = clampDia(y, m, diaCorte);
  let corteDate = new Date(y, m, corteEsteMesDia);
  if (d > corteEsteMesDia) {
    corteDate = new Date(y, m + 1, clampDia(y, m + 1, diaCorte));
  }

  const prevCorteDate = new Date(
    corteDate.getFullYear(),
    corteDate.getMonth() - 1,
    clampDia(corteDate.getFullYear(), corteDate.getMonth() - 1, diaCorte)
  );
  const inicioDate = new Date(prevCorteDate);
  inicioDate.setDate(inicioDate.getDate() + 1);

  let pagoDate: Date;
  if (diaPago > diaCorte) {
    pagoDate = new Date(
      corteDate.getFullYear(),
      corteDate.getMonth(),
      clampDia(corteDate.getFullYear(), corteDate.getMonth(), diaPago)
    );
  } else {
    pagoDate = new Date(
      corteDate.getFullYear(),
      corteDate.getMonth() + 1,
      clampDia(corteDate.getFullYear(), corteDate.getMonth() + 1, diaPago)
    );
  }

  return { fechaInicio: inicioDate, fechaCorte: corteDate, fechaPago: pagoDate };
}

export function diasHasta(fecha: Date, hoy: Date = new Date()): number {
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
