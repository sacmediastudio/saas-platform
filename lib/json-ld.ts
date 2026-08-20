/**
 * Arma las props para un <script type="application/ld+json"> — datos
 * estructurados que le dicen a Google "esto es un restaurante", "esto
 * es un negocio", etc., para poder mostrar resultados más ricos
 * (calificación, horario) en la búsqueda.
 *
 * Se escapa "<" a propósito: si el nombre de un negocio tuviera algo
 * como "</script><script>" (poco probable, pero no hay que confiar en
 * eso), esto evita que se "corte" el script de forma maliciosa.
 */
export function jsonLdScriptProps(data: object): { __html: string } {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return { __html: json };
}
