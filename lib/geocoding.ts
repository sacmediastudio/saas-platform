const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export function isGeocodingConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

/**
 * Convierte una dirección de texto libre en coordenadas reales, para
 * "cerca de mí" en Zertoo Eats. Se llama UNA sola vez por negocio
 * (cuando activa Zertoo Eats, o cambia su dirección), no en cada
 * visita — por eso el volumen de llamadas se queda tranquilamente
 * dentro del nivel gratis de Google incluso con muchos negocios.
 *
 * Devuelve null si falla o no hay clave configurada — nunca lanza un
 * error que rompa el guardado de los demás ajustes por esto.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
      console.error("Geocodificación sin resultados para:", address, "— status:", data.status);
      return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (err) {
    console.error("Error al geocodificar dirección:", err);
    return null;
  }
}
