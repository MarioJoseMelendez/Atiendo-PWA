import { isProvider, providerOrder, type Provider } from "@/lib/ai";
import { INVENTORY_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import {
  completeChat,
  PROVIDERS,
  providerModel,
  resolveProviderKeys,
} from "@/lib/ai-server";
import { parseInventoryDraft, type InventoryDraft } from "@/lib/import";
import { getDb, saveKey } from "@/lib/server-db";
import type { Store } from "@/lib/types";

const MAX_TEXT = 20_000;
const MAX_EXISTING = 200;

type ExistingProduct = {
  name?: unknown;
  kind?: unknown;
  packageSize?: unknown;
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

async function attemptDraft(
  provider: Provider,
  key: string,
  model: string,
  userContent: string,
  request: Request,
): Promise<Attempt> {
  const result = await completeChat(
    provider,
    key,
    model,
    [
      { role: "system", content: INVENTORY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    request,
    { temperature: 0.2, maxTokens: 2048 },
  );
  if (!result.ok) return result;

  const parsed = parseInventoryDraft(result.content);
  if (!parsed.ok) {
    return { ok: false, error: `${PROVIDERS[provider].label}: ${parsed.error}` };
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

  const keys = resolveProviderKeys(provided, db.keys);

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
    const model = providerModel(provider);
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
