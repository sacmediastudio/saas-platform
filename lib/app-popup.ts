import { z } from "zod";

// Validación compartida de crear/editar un pop-up de la app.
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Debe empezar con http:// o https://");

export const popupSchema = z.object({
  title: z.string().trim().min(1).max(80),
  imageUrl: httpUrl,
  tenantSlug: z.string().trim().max(80).nullable().optional(),
  linkUrl: httpUrl.nullable().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export type PopupInput = z.infer<typeof popupSchema>;

export function popupData(input: PopupInput) {
  return {
    title: input.title,
    imageUrl: input.imageUrl,
    tenantSlug: input.tenantSlug?.trim() || null,
    linkUrl: input.linkUrl || null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
}

/** Condición Prisma de "activo y dentro de su vigencia" en este momento. */
export function livePopupWhere(now = new Date()) {
  return {
    active: true,
    OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
  };
}
