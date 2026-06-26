import { z } from "zod";

export const transaccionTipoSchema = z.enum([
  "ingreso",
  "egreso",
  "transferencia",
  "transferencia_externa",
]);

export const transaccionSchema = z
  .object({
    fecha: z.string().min(1, "La fecha es requerida"),
    descripcion: z.string().max(255).optional().or(z.literal("")),
    comercio: z.string().max(100).optional().or(z.literal("")),
    monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
    tipo: transaccionTipoSchema,
    cuenta_origen_id: z.string().uuid("Selecciona una cuenta"),
    cuenta_destino_id: z.string().uuid().optional().or(z.literal("")),
    destinatario_externo: z.string().max(150).optional().or(z.literal("")),
    linea_id: z.string().uuid().optional().or(z.literal("")),
    guardarBeneficiario: z.boolean().optional(),
    notas: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.tipo !== "transferencia" || !!data.cuenta_destino_id, {
    message: "Selecciona la cuenta destino",
    path: ["cuenta_destino_id"],
  })
  .refine((data) => data.tipo !== "transferencia_externa" || !!data.destinatario_externo, {
    message: "Ingresa el destinatario",
    path: ["destinatario_externo"],
  })
  .refine((data) => data.tipo !== "transferencia_externa" || !!data.linea_id, {
    message: "Selecciona la línea presupuestaria afectada",
    path: ["linea_id"],
  });

export type TransaccionInput = z.infer<typeof transaccionSchema>;
export type TransaccionFormInput = z.input<typeof transaccionSchema>;
