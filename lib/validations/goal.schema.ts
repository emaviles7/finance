import { z } from "zod";

export const metaAhorroSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  cuenta_id: z.string().uuid("Selecciona una cuenta de ahorro"),
  monto_meta: z.coerce.number().positive("El monto debe ser mayor a 0"),
  fecha_limite: z.string().optional().or(z.literal("")),
  color: z.string().default("#10B981"),
});

export type MetaAhorroInput = z.infer<typeof metaAhorroSchema>;
export type MetaAhorroFormInput = z.input<typeof metaAhorroSchema>;
