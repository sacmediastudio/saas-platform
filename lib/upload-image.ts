/**
 * Reemplaza el viejo patrón de "convertir la foto a base64 y guardarla
 * directo en la base de datos" — ahora la foto se redimensiona en el
 * navegador, se sube directo a S3/R2 (sin pasar por nuestro servidor),
 * y lo que se guarda en la base de datos es solo la URL pública final.
 */

// JPEG no soporta transparencia — si el archivo original es un PNG
// con fondo transparente, convertirlo a JPEG hace que el navegador
// rellene esas zonas con negro (el comportamiento estándar del
// canvas al exportar a un formato sin canal alfa). Por default se
// sigue usando JPEG (más liviano, y la mayoría de las fotos de un
// negocio no necesitan transparencia), pero para el logo del pase de
// Wallet específicamente hace falta preservar el PNG tal cual.
function resizeImageToBlob(file: File, maxWidth: number, format: "jpeg" | "png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no soportado"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const mimeType = format === "png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
          mimeType,
          format === "png" ? undefined : 0.82
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sube una foto y devuelve su URL pública final. Lanza un Error con un
 * mensaje legible si algo falla en cualquier paso (redimensionar, pedir
 * la URL firmada, o el PUT a S3/R2) — el componente que llama a esto
 * debe capturarlo con try/catch y mostrárselo al usuario.
 *
 * "format" en "png" preserva la transparencia original — úsalo para
 * cualquier imagen que dependa de tener fondo transparente (como el
 * logo del pase de Wallet). Por default sigue siendo "jpeg", igual
 * que antes, para no cambiarle el comportamiento a las subidas ya
 * existentes que no lo necesitan.
 */
export async function uploadImage(file: File, maxWidth = 800, format: "jpeg" | "png" = "jpeg"): Promise<string> {
  const blob = await resizeImageToBlob(file, maxWidth, format);
  const fileType = blob.type || "image/jpeg";

  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileType }),
  });

  if (!presignRes.ok) {
    let message = "No se pudo preparar la subida de la imagen";
    try {
      const body = await presignRes.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // sin cuerpo JSON legible, nos quedamos con el mensaje genérico
    }
    throw new Error(message);
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": fileType },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error("No se pudo subir la imagen al storage. Intenta de nuevo.");
  }

  return publicUrl;
}
