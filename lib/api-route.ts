import { NextResponse } from "next/server";

// requireTenant()/requireOwner()/requirePermission() (ver lib/auth.ts)
// tiran un `Response` crudo en el camino sin sesión/permiso — patrón
// que en Next.js App Router NO se convierte solo en la respuesta HTTP
// (a diferencia de redirect()/notFound(), que sí son señales internas
// que Next reconoce). Sin este wrapper, ese throw queda como excepción
// no atrapada y el cliente recibe un 500 vacío en vez del 401/403 con
// su JSON de error — bug real, preexistente, que no se notaba porque
// una sesión de navegador logueada casi nunca pasa por ese camino.
export async function withAuthErrors(
  handler: () => Promise<NextResponse>,
  extraHeaders?: Record<string, string>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof Response) {
      const body = await err.text();
      return new NextResponse(body, { status: err.status, headers: { ...Object.fromEntries(err.headers), ...extraHeaders } });
    }
    throw err;
  }
}
