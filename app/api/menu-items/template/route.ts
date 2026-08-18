import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireTenant } from "@/lib/auth";

// GET /api/menu-items/template — plantilla de Excel con las columnas
// correctas y un par de filas de ejemplo, lista para llenar. No trae
// fotos (esas se agregan plato por plato después, desde el dashboard —
// no hay forma práctica de meter una imagen en una celda de Excel).
export async function GET() {
  await requireTenant();

  const headers = ["Categoría", "Nombre del plato", "Descripción", "Descripción (inglés)", "Precio", "Destacado (Sí/No)"];
  const exampleRows = [
    ["Platos principales", "Hamburguesa clásica", "Pan, carne, queso, lechuga y tomate", "Bun, beef, cheese, lettuce and tomato", 8.5, "No"],
    ["Postres", "Cheesecake", "Con salsa de frutos rojos", "With red berry sauce", 5, "Sí"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  sheet["!cols"] = [{ wch: 20 }, { wch: 26 }, { wch: 34 }, { wch: 34 }, { wch: 10 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Menú");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-menu.xlsx"',
    },
  });
}
