import { z } from "zod";

export const reglaTipoSchema = z.enum(["contiene", "empieza_con", "termina_con", "exacto", "regex"]);

export const reglaSchema = z.object({
  patron: z.string().min(1, "El patrón es requerido").max(255),
  tipo: reglaTipoSchema.default("contiene"),
  campo: z.string().default("descripcion"),
  linea_id: z.string().uuid("Selecciona una línea presupuestaria"),
  prioridad: z.coerce.number().int().default(0),
});

export type ReglaInput = z.infer<typeof reglaSchema>;
export type ReglaFormInput = z.input<typeof reglaSchema>;
