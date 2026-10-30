import { parseInventoryDraft } from "@/lib/import";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";
const MAX_TEXT = 20_000;
const MAX_EXISTING = 200;

const SYSTEM_PROMPT = `Eres el asistente de "Atiendo", un inventario para una librería en Guatemala. Convierte texto libre, listas o facturas en artículos del inventario.

Reglas del inventario:
- Cada artículo es "individual" (se cobra por pieza) o "paquete" (se cobra el paquete completo y tiene packageSize piezas).
- Un mismo producto puede venderse de dos formas con precios distintos. Por ejemplo: "hoja carta" individual a Q0.25 y el ciento (paquete de 100) a Q20.00. En ese caso devuelve DOS artículos con el mismo nombre: uno individual y otro paquete.
- La existencia de un individual se cuenta en piezas; la de un paquete se cuenta en paquetes. Si dice "tengo 5 cientos", el paquete de 100 lleva stock 5.
- Convierte "ciento" a paquete de 100, "docena" a paquete de 12, "caja" o "bulto" al tamaño que indique el texto.
- Usa los grupos existentes si encajan. Si no, propone un grupo corto, por ejemplo "Papelería", "Novela", "Textos".
- No inventes artículos que no aparezcan en el texto. Si falta un precio, no lo inventes: describe la duda en summary y omite ese artículo.
- Los precios van en centavos de quetzal, enteros (Q0.25 = 25; Q20.00 = 2000).

Devuelve SOLO un objeto JSON con esta forma exacta, sin markdown ni texto adicional:
{"summary":"resumen breve de lo que entendiste","groups":["Papelería"],"products":[{"group":"Papelería","name":"Hoja carta","kind":"individual","packageSize":null,"priceCents":25,"stock":300},{"group":"Papelería","name":"Hoja carta","kind":"paquete","packageSize":100,"priceCents":2000,"stock":5}]}`;

type ExistingProduct = {
  name?: unknown;
  kind?: unknown;
  packageSize?: unknown;
};

type RequestBody = {
  text?: unknown;
  apiKey?: unknown;
  existing?: unknown;
};

function buildExistingText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const existing = value as { groups?: unknown; products?: unknown };
  const groups = Array.isArray(existing.groups)
    ? existing.groups.filter((group): group is string => typeof group === "string").slice(0, 60)
    : [];
  const products = Array.isArray(existing.products)
    ? (existing.products as ExistingProduct[])
        .slice(0, MAX_EXISTING)
        .map((product) => {
          if (!product || typeof product !== "object") return null;
          const name = typeof product.name === "string" ? product.name.slice(0, 80) : null;
          if (!name) return null;
          const kind = product.kind === "paquete" ? "paquete" : "individual";
          const size =
            kind === "paquete" && typeof product.packageSize === "number"
              ? ` de ${product.packageSize}`
              : "";
          return `${name} (${kind}${size})`;
        })
        .filter((product): product is string => product !== null)
    : [];

  if (groups.length === 0 && products.length === 0) return "";
  return `\n\nInventario actual (no lo repitas, solo úsalo para no duplicar grupos):\nGrupos: ${
    groups.join(", ") || "(ninguno)"
  }\nArtículos: ${products.join(", ") || "(ninguno)"}`;
}

function nvidiaError(status: number): string {
  if (status === 401 || status === 403) {
    return "La clave de NVIDIA no es válida o no tiene permiso.";
  }
  if (status === 429) {
    return "NVIDIA está limitando las solicitudes. Espera un momento y vuelve a intentar.";
  }
  if (status === 404) {
    return "El modelo de NVIDIA configurado no está disponible.";
  }
  return `NVIDIA respondió con un error (${status}). Intenta de nuevo.`;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ ok: false, error: "La solicitud no es válida." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ ok: false, error: "Escribe o pega la lista de productos." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return Response.json(
      { ok: false, error: "La lista es demasiado larga. Divídela en partes." },
      { status: 413 },
    );
  }

  const apiKey =
    (typeof body.apiKey === "string" ? body.apiKey.trim() : "") ||
    (process.env.NVIDIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error:
          "Falta la clave de NVIDIA. Pégala en esta página o define NVIDIA_API_KEY en .env.local.",
      },
      { status: 503 },
    );
  }

  const model = (process.env.NVIDIA_MODEL ?? "").trim() || DEFAULT_MODEL;
  const userContent = `${text}${buildExistingText(body.existing)}`;

  let response: Response;
  try {
    response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        ok: false,
        error: timedOut
          ? "NVIDIA tardó demasiado en responder. Intenta con una lista más corta."
          : "No se pudo conectar con NVIDIA. Revisa la conexión a internet.",
      },
      { status: 504 },
    );
  }

  if (!response.ok) {
    return Response.json({ ok: false, error: nvidiaError(response.status) }, { status: 502 });
  }

  let content: string | undefined;
  try {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const raw = payload.choices?.[0]?.message?.content;
    content = typeof raw === "string" ? raw : undefined;
  } catch {
    return Response.json(
      { ok: false, error: "NVIDIA devolvió una respuesta que no se pudo leer." },
      { status: 502 },
    );
  }

  if (!content) {
    return Response.json(
      { ok: false, error: "NVIDIA no devolvió contenido. Intenta de nuevo." },
      { status: 502 },
    );
  }

  const parsed = parseInventoryDraft(content);
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: parsed.error, raw: content.slice(0, 2000) },
      { status: 422 },
    );
  }

  return Response.json({ ok: true, draft: parsed.draft, model });
}
