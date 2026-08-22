import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireTenant } from "@/lib/auth";

interface ParsedRow {
  rowNumber: number; // número de fila real en el Excel, para que el negocio la ubique fácil
  categoria: string;
  nombre: string;
  descripcion: string;
  descripcionEn: string;
  precio: number | null;
  destacado: boolean;
  errors: string[];
}

function parseBoolean(value: unknown): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "sí" || s === "si" || s === "yes" || s === "true" || s === "1";
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value).trim();
}

// La plataforma es bilingüe, así que el importador también acepta el
// encabezado en inglés, no solo el español exacto de la plantilla —
// alguien puede armar su propio Excel a mano, en el idioma que use su
// negocio. Comparación sin importar mayúsculas ni espacios extra.
function normalizeHeader(s: string): string {
  return s.trim().toLowerCase();
}

function pickByAliases(normalizedRow: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = normalizedRow.get(normalizeHeader(alias));
    if (value !== undefined) return value;
  }
  return "";
}

const CATEGORIA_ALIASES = ["Categoría", "Categoria", "Category"];
const NOMBRE_ALIASES = ["Nombre del plato", "Dish Name", "Name", "Item Name", "Item"];
const DESCRIPCION_ALIASES = ["Descripción", "Descripcion", "Description"];
const DESCRIPCION_EN_ALIASES = [
  "Descripción (inglés)",
  "Descripcion (ingles)",
  "Description (English)",
  "English Description",
];
const PRECIO_ALIASES = ["Precio", "Price"];
const DESTACADO_ALIASES = ["Destacado (Sí/No)", "Destacado (Si/No)", "Featured (Yes/No)", "Featured"];

// POST /api/menu-items/import/preview — recibe el archivo, lo valida
// fila por fila, y devuelve el resultado para que el negocio lo revise
// ANTES de que se guarde nada de verdad.
//
// Usa exceljs (no la librería "xlsx"/SheetJS) a propósito — SheetJS
// tiene vulnerabilidades conocidas (contaminación de prototipo, ReDoS)
// sin parche disponible en npm, justo en la función de LEER un archivo
// — que es exactamente lo que hacemos acá con un archivo subido por
// el usuario. exceljs es una librería activa y sin ese problema.
export async function POST(req: NextRequest) {
  await requireTenant();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }

  // Límite de tamaño ANTES de intentar parsear — reduce la superficie
  // de un archivo gigante o malicioso pensado para colgar el proceso.
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo es demasiado grande (máximo 5 MB)." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // "any" a propósito: exceljs y @types/node traen definiciones de
    // Buffer ligeramente distintas entre sí (una versión más nueva que
    // la otra) — a nivel de ejecución es exactamente el mismo objeto,
    // esto solo evita que TypeScript compare esas dos formas del tipo.
    await workbook.xlsx.load(buffer as any);
  } catch {
    return NextResponse.json({ error: "No pudimos leer ese archivo — ¿es un Excel válido?" }, { status: 400 });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "El archivo no tiene ninguna hoja con datos." }, { status: 400 });
  }

  // Mapea cada columna por su encabezado (fila 1), no por posición fija
  // — así no importa si alguien reordena las columnas de la plantilla.
  const headerByColumn: Record<number, string> = {};
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headerByColumn[colNumber] = cellToString(cell.value);
  });

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado, no es un plato

    const byHeader: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headerByColumn[colNumber];
      if (header) byHeader[header] = cellToString(cell.value);
    });
    const normalizedRow = new Map(Object.entries(byHeader).map(([k, v]) => [normalizeHeader(k), v]));

    const categoria = pickByAliases(normalizedRow, CATEGORIA_ALIASES).trim();
    const nombre = pickByAliases(normalizedRow, NOMBRE_ALIASES).trim();
    const descripcion = pickByAliases(normalizedRow, DESCRIPCION_ALIASES).trim();
    const descripcionEn = pickByAliases(normalizedRow, DESCRIPCION_EN_ALIASES).trim();
    const precioRaw = pickByAliases(normalizedRow, PRECIO_ALIASES);
    const precio = Number(precioRaw.replace(",", "."));
    const destacado = parseBoolean(pickByAliases(normalizedRow, DESTACADO_ALIASES));

    // Ignora filas totalmente vacías (ej. al final del archivo) sin marcarlas como error.
    if (!categoria && !nombre && !precioRaw) return;

    const errors: string[] = [];
    if (!categoria) errors.push("Falta la categoría");
    if (!nombre) errors.push("Falta el nombre del plato");
    if (!precioRaw || Number.isNaN(precio) || precio <= 0) errors.push("El precio no es válido");

    rows.push({
      rowNumber,
      categoria,
      nombre,
      descripcion,
      descripcionEn,
      precio: Number.isNaN(precio) ? null : precio,
      destacado,
      errors,
    });
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "El archivo no tiene ninguna fila con datos." }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Máximo 500 platos por importación." }, { status: 400 });
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  return NextResponse.json({ validRows, invalidRows, total: rows.length });
}
