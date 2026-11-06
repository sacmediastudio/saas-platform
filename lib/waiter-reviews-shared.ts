// Constantes y tipos de reseñas de meseros que también necesita el
// navegador (el dashboard) — por eso viven aparte de lib/waiter-reviews.ts,
// que importa la base de datos y no puede llegar al cliente.

export const WAITER_REVIEW_RADIUS_MIN = 50;
export const WAITER_REVIEW_RADIUS_MAX = 300;
export const WAITER_REVIEW_GRACE_MAX = 240;
export const WAITER_NOTE_MAX = 500;
// Una reseña por mesero y dispositivo cada tantas horas.
export const WAITER_REVIEW_COOLDOWN_HOURS = 12;

export interface WaiterReviewSettings {
  enabled: boolean;
  radiusM: number;
  graceMinutes: number;
  latitude: number | null;
  longitude: number | null;
  hasAddress: boolean;
  geocodingAvailable: boolean;
  hasHours: boolean;
}
