import { buildLabelDocx, buildLabelPdf } from "@/lib/label-export";
import { isLabelFormat, isLabelScope, labelFileName, labelSheet } from "@/lib/labels";
import { getDb } from "@/lib/server-db";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const format = url.searchParams.get("format") ?? "pdf";
  const id = url.searchParams.get("id");

  if (!isLabelScope(scope) || !isLabelFormat(format)) {
    return Response.json(
      { ok: false, error: "El tipo de descarga no es válido." },
      { status: 400 },
    );
  }
  if ((scope === "group" || scope === "product") && !id) {
    return Response.json(
      { ok: false, error: "Falta el grupo o el producto que quieres descargar." },
      { status: 400 },
    );
  }

  const db = await getDb();
  if (!db.store) {
    return Response.json(
      { ok: false, error: "Todavía no hay inventario para descargar." },
      { status: 404 },
    );
  }

  const sheet = labelSheet(db.store, scope, id);
  if (!sheet) {
    return Response.json(
      { ok: false, error: "Ese grupo o producto ya no existe." },
      { status: 404 },
    );
  }
  if (sheet.products.length === 0) {
    return Response.json(
      { ok: false, error: "No hay etiquetas para esa selección." },
      { status: 404 },
    );
  }

  try {
    const data = format === "pdf" ? await buildLabelPdf(sheet) : await buildLabelDocx(sheet);
    const filename = labelFileName(sheet, format);
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo generar el archivo. Intenta de nuevo." },
      { status: 500 },
    );
  }
}
