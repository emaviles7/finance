import { z } from "zod";

export const categoriaSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es requerido").max(100),
    color: z.string().default("#7C3AED"),
    es_ingreso: z.boolean().default(false),
    es_ahorro: z.boolean().default(false),
  })
  .refine((data) => !(data.es_ingreso && data.es_ahorro), {
    message: "Una categoría no puede ser de ingreso y de ahorro a la vez",
    path: ["es_ahorro"],
  });

export type CategoriaFormValues = z.infer<typeof categoriaSchema>;
export type CategoriaFormInput = z.input<typeof categoriaSchema>;
