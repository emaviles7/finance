import { z } from "zod";

export const presupuestoSchema = z.object({
  linea_id: z.string().uuid(),
  monto_presupuestado: z.coerce.number().min(0, "El monto no puede ser negativo"),
  anio: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
  rollover: z.boolean().default(false),
});

export type PresupuestoInput = z.infer<typeof presupuestoSchema>;
export type PresupuestoFormInput = z.input<typeof presupuestoSchema>;
