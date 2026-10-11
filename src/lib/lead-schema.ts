// Contrato del formulario de leads (compartido entre navegador y Worker).
// Cuando definamos el formato del CRM propio, se ajusta aquí y en server/crm.ts.
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const leadSchema = z
  .object({
    nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
    telefono: optionalText(30),
    email: z
      .union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Email inválido"))])
      .optional()
      .transform((v) => (v ? v : undefined)),
    mensaje: optionalText(2000),
    /** Campos adicionales que agregue el diseño (ej. fecha, cantidad de personas). */
    extra: z.record(z.string(), z.string().max(500)).optional(),

    // Metadatos que agrega el script del formulario (no los llena el usuario)
    event_id: z.uuid(),
    form_name: z.string().max(60).default("contacto"),
    page_url: z.string().max(1000).optional(),
    consent: z.boolean().default(false),
    attribution: z.record(z.string(), z.string().max(1000)).default({}),
    turnstile_token: z.string().max(2048).optional(),
    /** Honeypot anti-bots: debe venir vacío. */
    website: z.string().optional(),
  })
  .refine((d) => d.telefono || d.email, {
    message: "Ingresa un teléfono o un email",
    path: ["telefono"],
  });

export type LeadInput = z.input<typeof leadSchema>;
export type Lead = z.output<typeof leadSchema>;
