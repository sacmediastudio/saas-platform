import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
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

// POST /api/menu-items/import/preview — recibe el archivo, lo valida
// fila por fila, y devuelve el resultado para que el negocio lo revise
// ANTES de que se guarde nada de verdad.
export async function POST(req: NextRequest) {
  await requireTenant();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "No pudimos leer ese archivo — ¿es un Excel válido?" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return NextResponse.json({ error: "El archivo no tiene ninguna hoja con datos." }, { status: 400 });
  }

  // defval:"" para que las celdas vacías no rompan el mapeo por columna
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (raw.length === 0) {
    return NextResponse.json({ error: "El archivo no tiene ninguna fila con datos." }, { status: 400 });
  }
  if (raw.length > 500) {
    return NextResponse.json({ error: "Máximo 500 platos por importación." }, { status: 400 });
  }

  const rows: ParsedRow[] = raw.map((r, i) => {
    const categoria = String(r["Categoría"] ?? "").trim();
    const nombre = String(r["Nombre del plato"] ?? "").trim();
    const descripcion = String(r["Descripción"] ?? "").trim();
    const descripcionEn = String(r["Descripción (inglés)"] ?? "").trim();
    const precioRaw = r["Precio"];
    const precio = typeof precioRaw === "number" ? precioRaw : Number(String(precioRaw).replace(",", "."));
    const destacado = parseBoolean(r["Destacado (Sí/No)"]);

    const errors: string[] = [];
    if (!categoria) errors.push("Falta la categoría");
    if (!nombre) errors.push("Falta el nombre del plato");
    if (!precioRaw || Number.isNaN(precio) || precio <= 0) errors.push("El precio no es válido");

    return {
      rowNumber: i + 2, // +2: la fila 1 es el encabezado, y Excel empieza en 1 no en 0
      categoria,
      nombre,
      descripcion,
      descripcionEn,
      precio: Number.isNaN(precio) ? null : precio,
      destacado,
      errors,
    };
  });

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  return NextResponse.json({ validRows, invalidRows, total: rows.length });
}
