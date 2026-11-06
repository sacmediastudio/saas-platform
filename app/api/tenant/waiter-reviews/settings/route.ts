import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { withAuthErrors } from "@/lib/api-route";
import { getEnabledModules } from "@/lib/modules";
import { geocodeAddress } from "@/lib/geocoding";
import {
  getWaiterReviewSettings,
  WAITER_REVIEW_GRACE_MAX,
  WAITER_REVIEW_RADIUS_MAX,
  WAITER_REVIEW_RADIUS_MIN,
} from "@/lib/waiter-reviews";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  radiusM: z.number().int().min(WAITER_REVIEW_RADIUS_MIN).max(WAITER_REVIEW_RADIUS_MAX).optional(),
  graceMinutes: z.number().int().min(0).max(WAITER_REVIEW_GRACE_MAX).optional(),
  // Pin exacto: o coordenadas (botón "usar mi ubicación actual") o
  // geocodificar la dirección del negocio.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geocodeAddress: z.boolean().optional(),
});

export function GET() {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    return NextResponse.json(await getWaiterReviewSettings(session.tenantId));
  });
}

export function PATCH(req: NextRequest) {
  return withAuthErrors(async () => {
    const session = await requirePermission("REVIEWS");
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    const { enabled, radiusM, graceMinutes, latitude, longitude, geocodeAddress: wantsGeocode } = parsed.data;

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
    if (!getEnabledModules(tenant).includes("RESTAURANT")) {
      return NextResponse.json({ error: "Las reseñas de meseros son para negocios con el módulo de Menú activo." }, { status: 400 });
    }

    const data: {
      waiterReviewsEnabled?: boolean;
      waiterReviewRadiusM?: number;
      waiterReviewGraceMinutes?: number;
      latitude?: number;
      longitude?: number;
    } = {};

    if (radiusM !== undefined) data.waiterReviewRadiusM = radiusM;
    if (graceMinutes !== undefined) data.waiterReviewGraceMinutes = graceMinutes;

    if (latitude !== undefined && longitude !== undefined) {
      data.latitude = latitude;
      data.longitude = longitude;
    } else if (wantsGeocode) {
      if (!tenant.address) return NextResponse.json({ error: "Primero agrega la dirección de tu negocio en Ajustes." }, { status: 400 });
      const coords = await geocodeAddress(tenant.address);
      if (!coords) return NextResponse.json({ error: "No pudimos ubicar esa dirección. Usa tu ubicación actual desde el local." }, { status: 400 });
      data.latitude = coords.lat;
      data.longitude = coords.lng;
    }

    if (enabled !== undefined) {
      if (enabled) {
        const lat = data.latitude ?? tenant.latitude;
        const lng = data.longitude ?? tenant.longitude;
        if (lat === null || lat === undefined || lng === null || lng === undefined) {
          return NextResponse.json({ error: "Primero marca la ubicación exacta de tu local." }, { status: 400 });
        }
        const hoursCount = await db.businessHours.count({ where: { tenantId: session.tenantId } });
        if (hoursCount === 0) {
          return NextResponse.json({ error: "Primero configura tu horario de atención." }, { status: 400 });
        }
      }
      data.waiterReviewsEnabled = enabled;
    }

    if (Object.keys(data).length > 0) {
      await db.tenant.update({ where: { id: session.tenantId }, data });
    }
    return NextResponse.json(await getWaiterReviewSettings(session.tenantId));
  });
}
