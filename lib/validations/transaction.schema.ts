import { z } from "zod";

export const transaccionTipoSchema = z.enum([
  "ingreso",
  "egreso",
  "transferencia",
  "transferencia_externa",
]);

// Flujo MVP: todas las opciones son OPCIONALES salvo el monto (la BD exige
// monto > 0) y la fecha (necesaria para el libro mayor; el formulario la
// rellena con hoy). El método de pago / origen es texto libre.
export const transaccionSchema = z.object({
  fecha: z.string().min(1, "La fecha es requerida"),
  descripcion: z.string().max(255).optional().or(z.literal("")),
  comercio: z.string().max(100).optional().or(z.literal("")),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  tipo: transaccionTipoSchema.default("egreso"),
  // Lo provee el formulario/servidor con la Cuenta Madre (bolsa única).
  cuenta_origen_id: z.string().uuid().optional().or(z.literal("")),
  cuenta_destino_id: z.string().uuid().optional().or(z.literal("")),
  destinatario_externo: z.string().max(150).optional().or(z.literal("")),
  linea_id: z.string().uuid().optional().or(z.literal("")),
  metodo_pago: z.string().max(100).optional().or(z.literal("")),
  guardarBeneficiario: z.boolean().optional(),
  notas: z.string().optional().or(z.literal("")),
});

export type TransaccionInput = z.infer<typeof transaccionSchema>;
export type TransaccionFormInput = z.input<typeof transaccionSchema>;
