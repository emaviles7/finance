import { z } from "zod";

export const cuentaTipoSchema = z.enum([
  "efectivo",
  "banco",
  "cuenta_conjunta",
  "ahorro",
  "tarjeta_debito",
  "tarjeta_credito",
]);

export const cuentaSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es requerido").max(100),
    institucion: z.string().max(100).optional().or(z.literal("")),
    tipo: cuentaTipoSchema,
    saldo_inicial: z.coerce.number().default(0),
    limite_credito: z.coerce.number().positive().optional(),
    dia_corte: z.coerce.number().int().min(1).max(31).optional(),
    dia_pago: z.coerce.number().int().min(1).max(31).optional(),
    color: z.string().default("#7C3AED"),
  })
  .refine(
    (data) => data.tipo !== "tarjeta_credito" || (!!data.limite_credito && !!data.dia_corte && !!data.dia_pago),
    {
      message: "Las tarjetas de crédito requieren límite, día de corte y día de pago",
      path: ["limite_credito"],
    }
  );

export type CuentaInput = z.infer<typeof cuentaSchema>;
export type CuentaFormInput = z.input<typeof cuentaSchema>;
