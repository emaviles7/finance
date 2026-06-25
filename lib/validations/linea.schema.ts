import { z } from "zod";

export const lineaPresupuestariaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  categoria_id: z.string().uuid("Selecciona una categoría"),
  color: z.string().default("#7C3AED"),
});

export type LineaFormValues = z.infer<typeof lineaPresupuestariaSchema>;
export type LineaFormInput = z.input<typeof lineaPresupuestariaSchema>;
