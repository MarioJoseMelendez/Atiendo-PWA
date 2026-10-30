import { isProvider, providerOrder, type Provider } from "@/lib/ai";
import { parseInventoryDraft, type InventoryDraft } from "@/lib/import";
import { getDb, saveKey } from "@/lib/server-db";
import type { Store } from "@/lib/types";

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

type ProviderConfig = {
  label: string;
  url: string;
  defaultModel: string;
  envKey: string;
  envModel: string;
  extraHeaders?: (request: Request) => Record<string, string>;
};

const PROVIDERS: Record<Provider, ProviderConfig> = {
  nvidia: {
    label: "NVIDIA",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    envKey: "NVIDIA_API_KEY",
    envModel: "NVIDIA_MODEL",
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/auto",
    envKey: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    extraHeaders: (request) => ({
      "HTTP-Referer": new URL(request.url).origin,
      "X-Title": "Atiendo",
    }),
  },
};

type RequestBody = {
  text?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  apiKeys?: { nvidia?: unknown; openrouter?: unknown };
  existing?: unknown;
};

type Attempt =
  | { ok: true; draft: InventoryDraft }
  | { ok: false; error: string };

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

function existingFromStore(store: Store | null): unknown {
  if (!store) return undefined;
  return {
    groups: store.groups.map((group) => group.name),
    products: store.products.map((product) => ({
      name: product.name,
      kind: product.kind,
      packageSize: product.packageSize,
    })),
  };
}

function providerError(provider: Provider, status: number): string {
  const label = PROVIDERS[provider].label;
  if (status === 401 || status === 403) {
    return `La clave de ${label} no es válida o no tiene permiso.`;
  }
  if (status === 429) {
    return `${label} está limitando las solicitudes. Espera un momento y vuelve a intentar.`;
  }
  if (status === 404) {
    return `El modelo de ${label} configurado no está disponible.`;
  }
  return `${label} respondió con un error (${status}). Intenta de nuevo.`;
}

async function attemptDraft(
  provider: Provider,
  key: string,
  model: string,
  userContent: string,
  request: Request,
): Promise<Attempt> {
  const config = PROVIDERS[provider];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
    ...(config.extraHeaders ? config.extraHeaders(request) : {}),
  };

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers,
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
    return {
      ok: false,
      error: timedOut
        ? `${config.label} tardó demasiado en responder.`
        : `No se pudo conectar con ${config.label}.`,
    };
  }

  if (!response.ok) {
    return { ok: false, error: providerError(provider, response.status) };
  }

  let content: string | undefined;
  try {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const raw = payload.choices?.[0]?.message?.content;
    content = typeof raw === "string" ? raw : undefined;
  } catch {
    return { ok: false, error: `${config.label} devolvió una respuesta que no se pudo leer.` };
  }

  if (!content) {
    return { ok: false, error: `${config.label} no devolvió contenido.` };
  }

  const parsed = parseInventoryDraft(content);
  if (!parsed.ok) {
    return { ok: false, error: `${config.label}: ${parsed.error}` };
  }

  return { ok: true, draft: parsed.draft };
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

  const apiKeys =
    body.apiKeys && typeof body.apiKeys === "object" ? body.apiKeys : {};
  const legacyNvidia = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const provided: Partial<Record<Provider, string>> = {
    nvidia: (typeof apiKeys.nvidia === "string" ? apiKeys.nvidia.trim() : "") || legacyNvidia,
    openrouter:
      typeof apiKeys.openrouter === "string" ? apiKeys.openrouter.trim() : "",
  };

  const db = await getDb();

  await Promise.all(
    (Object.entries(provided) as [Provider, string][])
      .filter(([, key]) => key.length > 0)
      .map(([provider, key]) => saveKey(provider, key).catch(() => undefined)),
  );

  const keys: Record<Provider, string> = {
    nvidia:
      provided.nvidia ||
      db.keys.nvidia?.trim() ||
      (process.env.NVIDIA_API_KEY ?? "").trim(),
    openrouter:
      provided.openrouter ||
      db.keys.openrouter?.trim() ||
      (process.env.OPENROUTER_API_KEY ?? "").trim(),
  };

  const preferred: Provider = isProvider(body.provider) ? body.provider : "openrouter";
  const available = providerOrder(preferred, keys);

  if (available.length === 0) {
    return Response.json(
      {
        ok: false,
        error:
          "Falta una clave de IA. Pega la de NVIDIA u OpenRouter en esta página o define NVIDIA_API_KEY u OPENROUTER_API_KEY en .env.local.",
      },
      { status: 503 },
    );
  }

  const userContent = `${text}${buildExistingText(
    body.existing ?? existingFromStore(db.store),
  )}`;

  const errors: string[] = [];
  for (const provider of available) {
    const config = PROVIDERS[provider];
    const model = (process.env[config.envModel] ?? "").trim() || config.defaultModel;
    const result = await attemptDraft(provider, keys[provider], model, userContent, request);
    if (result.ok) {
      return Response.json({
        ok: true,
        draft: result.draft,
        provider,
        model,
        fallback: provider !== preferred,
      });
    }
    errors.push(result.error);
  }

  return Response.json(
    {
      ok: false,
      error: `No se pudo interpretar la lista. ${errors.join(" ")}`,
    },
    { status: 502 },
  );
}
