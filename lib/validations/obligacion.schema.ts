import { z } from "zod";

export const obligacionTipoSchema = z.enum([
  "tarjeta_credito",
  "tarjeta_debito",
  "prestamo_terceros",
  "prestamo_personal",
  "adelanto_efectivo",
  "otro",
]);

export const obligacionSchema = z.object({
  tipo: obligacionTipoSchema,
  nombre: z.string().min(1, "El nombre es requerido").max(150),
  beneficiario: z.string().max(150).optional().or(z.literal("")),
  monto_total: z.coerce.number().nonnegative().optional(),
  anio: z.coerce.number().int().optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  observaciones: z.string().optional().or(z.literal("")),
});

export type ObligacionFormValues = z.infer<typeof obligacionSchema>;
export type ObligacionFormInput = z.input<typeof obligacionSchema>;

export const marcarPagadaSchema = z.object({
  fecha_pago: z.string().min(1, "La fecha es requerida"),
  monto_pagado: z.coerce.number().positive("El monto debe ser mayor a 0"),
  cuenta_pago_id: z.string().uuid().optional().or(z.literal("")),
  transaccion_id: z.string().uuid().optional().or(z.literal("")),
  beneficiario: z.string().max(150).optional().or(z.literal("")),
  observaciones: z.string().optional().or(z.literal("")),
});

export type MarcarPagadaValues = z.infer<typeof marcarPagadaSchema>;
export type MarcarPagadaInput = z.input<typeof marcarPagadaSchema>;
