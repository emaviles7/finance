import { z } from "zod";

export const metodoPagoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  color: z.string().default("#7C3AED"),
});

export type MetodoPagoFormValues = z.infer<typeof metodoPagoSchema>;
export type MetodoPagoFormInput = z.input<typeof metodoPagoSchema>;
