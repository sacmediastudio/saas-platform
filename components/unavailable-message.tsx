// Bilingüe mostrando los 2 idiomas juntos, no uno solo — a esta altura
// (antes de que cargue nada del negocio) todavía no sabemos qué idioma
// prefiere quien visita, y no vale la pena construir detección de
// idioma para un mensaje tan puntual y poco frecuente.
export default function UnavailableMessage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center bg-[#F7F8F4]">
      <div>
        <p className="text-lg font-semibold text-[#002D09] mb-1">No disponible por el momento</p>
        <p className="text-base text-[#002D09]/50">Not available right now</p>
      </div>
    </div>
  );
}
