import { publicKeyStatuses } from "@/lib/ai";
import { getDb, saveStore } from "@/lib/server-db";
import { isStore } from "@/lib/storage";

export async function GET() {
  const db = await getDb();
  return Response.json(
    {
      ok: true,
      store: db.store,
      keys: publicKeyStatuses(db.keys),
      updatedAt: db.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "La solicitud no es válida." },
      { status: 400 },
    );
  }

  const store =
    body && typeof body === "object" ? (body as { store?: unknown }).store : undefined;
  if (!isStore(store)) {
    return Response.json(
      { ok: false, error: "El inventario no es válido." },
      { status: 400 },
    );
  }

  try {
    await saveStore(store);
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo guardar en la base local." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
