import { isProvider, publicKeyStatuses } from "@/lib/ai";
import { getDb, saveKey } from "@/lib/server-db";

export async function GET() {
  const db = await getDb();
  return Response.json(
    { ok: true, keys: publicKeyStatuses(db.keys) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "La solicitud no es válida." },
      { status: 400 },
    );
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const provider = record.provider;
  const key = typeof record.key === "string" ? record.key.trim() : "";

  if (!isProvider(provider)) {
    return Response.json(
      { ok: false, error: "El proveedor no es válido." },
      { status: 400 },
    );
  }
  if (!key) {
    return Response.json(
      {
        ok: false,
        error: "Escribe una clave nueva. La clave guardada no se borra.",
      },
      { status: 400 },
    );
  }

  try {
    await saveKey(provider, key);
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo guardar la clave en la base local." },
      { status: 500 },
    );
  }

  const db = await getDb();
  return Response.json({ ok: true, keys: publicKeyStatuses(db.keys) });
}
