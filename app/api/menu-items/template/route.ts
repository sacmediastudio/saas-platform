import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireTenant } from "@/lib/auth";

// GET /api/menu-items/template — plantilla de Excel con las columnas
// correctas y un par de filas de ejemplo, lista para llenar. No trae
// fotos (esas se agregan plato por plato después, desde el dashboard —
// no hay forma práctica de meter una imagen en una celda de Excel).
export async function GET() {
  await requireTenant();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Menú");

  sheet.columns = [
    { header: "Categoría", key: "categoria", width: 20 },
    { header: "Nombre del plato", key: "nombre", width: 26 },
    { header: "Descripción", key: "descripcion", width: 34 },
    { header: "Descripción (inglés)", key: "descripcionEn", width: 34 },
    { header: "Precio", key: "precio", width: 10 },
    { header: "Destacado (Sí/No)", key: "destacado", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    categoria: "Platos principales",
    nombre: "Hamburguesa clásica",
    descripcion: "Pan, carne, queso, lechuga y tomate",
    descripcionEn: "Bun, beef, cheese, lettuce and tomato",
    precio: 8.5,
    destacado: "No",
  });
  sheet.addRow({
    categoria: "Postres",
    nombre: "Cheesecake",
    descripcion: "Con salsa de frutos rojos",
    descripcionEn: "With red berry sauce",
    precio: 5,
    destacado: "Sí",
  });

  const buffer = await workbook.xlsx.writeBuffer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-menu.xlsx"',
    },
  });
}
