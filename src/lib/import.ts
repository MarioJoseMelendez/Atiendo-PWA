import { saveGroup, saveProduct, suggestPrefix } from "./inventory";
import type { ProductInput, SaleKind, Store } from "./types";

export type DraftProduct = {
  group: string;
  name: string;
  kind: SaleKind;
  packageSize: number | null;
  priceCents: number;
  stock: number;
};

export type InventoryDraft = {
  summary: string;
  groups: string[];
  products: DraftProduct[];
};

export type DraftParseResult =
  | { ok: true; draft: InventoryDraft }
  | { ok: false; error: string };

export type DraftImportResult =
  | { ok: true; store: Store; imported: number; skipped: number }
  | { ok: false; error: string };

const MAX_NAME = 80;
const MAX_PRODUCTS = 200;
const MAX_GROUPS = 40;
const MAX_PRICE_CENTS = 10_000_000;
const MAX_STOCK = 100_000;
const MAX_PACKAGE = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > max) return null;
  return text;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/^GTQ/i, "").replace(/^Q/i, "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) text = text.replace(/,/g, "");
  else if (text.includes(",")) text = text.replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed != null) return Math.round(parsed);
  if (typeof value === "string") {
    const match = value.match(/\d+(?:[.,]\d+)?/);
    if (match) {
      const fallback = parseNumber(match[0]);
      if (fallback != null) return Math.round(fallback);
    }
  }
  return null;
}

function readPriceCents(item: Record<string, unknown>): number | null {
  const cents = toInteger(item.priceCents ?? item.precioCents ?? item.price_cents);
  if (cents != null && cents > 0) return cents;
  const price = parseNumber(item.price ?? item.precio);
  return price == null ? null : Math.round(price * 100);
}

function readKind(item: Record<string, unknown>): SaleKind {
  const raw = String(item.kind ?? item.tipo ?? "individual").toLocaleLowerCase("es");
  if (
    raw.includes("paquete") ||
    raw.includes("pack") ||
    raw.includes("ciento") ||
    raw.includes("docena") ||
    raw.includes("caja") ||
    raw.includes("bulto")
  ) {
    return "paquete";
  }
  return "individual";
}

function readPackageSize(item: Record<string, unknown>, kind: SaleKind): number | null {
  if (kind !== "paquete") return null;
  const size = toInteger(item.packageSize ?? item.piezasPorPaquete ?? item.size);
  if (size != null) return size;
  const raw = String(item.kind ?? item.tipo ?? "").toLocaleLowerCase("es");
  if (raw.includes("ciento")) return 100;
  if (raw.includes("docena")) return 12;
  return null;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function parseInventoryDraft(raw: string): DraftParseResult {
  const data = asRecord(extractJson(raw));
  if (!data) {
    return { ok: false, error: "La IA no devolvió un JSON válido." };
  }

  const productsRaw = data.products ?? data.articulos ?? data.items;
  if (!Array.isArray(productsRaw)) {
    return { ok: false, error: "La respuesta no trae una lista de artículos." };
  }
  if (productsRaw.length === 0) {
    return { ok: false, error: "La IA no encontró artículos para cargar." };
  }
  if (productsRaw.length > MAX_PRODUCTS) {
    return { ok: false, error: `Son demasiados artículos (máximo ${MAX_PRODUCTS}).` };
  }

  const products: DraftProduct[] = [];
  for (const [index, rawItem] of productsRaw.entries()) {
    const item = asRecord(rawItem);
    if (!item) {
      return { ok: false, error: `El artículo ${index + 1} no tiene el formato esperado.` };
    }
    const name = cleanText(item.name ?? item.nombre ?? item.articulo, MAX_NAME);
    const group = cleanText(item.group ?? item.grupo ?? item.categoria, MAX_NAME);
    if (!name || !group) {
      return { ok: false, error: `El artículo ${index + 1} necesita nombre y grupo.` };
    }

    const kind = readKind(item);
    const packageSize = readPackageSize(item, kind);
    if (
      kind === "paquete" &&
      (packageSize == null || packageSize < 2 || packageSize > MAX_PACKAGE)
    ) {
      return {
        ok: false,
        error: `El paquete de "${name}" necesita un tamaño entre 2 y ${MAX_PACKAGE}.`,
      };
    }

    const priceCents = readPriceCents(item);
    if (priceCents == null || priceCents <= 0 || priceCents > MAX_PRICE_CENTS) {
      return { ok: false, error: `El precio de "${name}" no es válido.` };
    }

    const stock = toInteger(item.stock ?? item.existencia ?? item.cantidad);
    if (stock == null || stock < 0 || stock > MAX_STOCK) {
      return { ok: false, error: `La existencia de "${name}" no es válida.` };
    }

    products.push({ group, name, kind, packageSize, priceCents, stock });
  }

  const groupsRaw = data.groups ?? data.grupos ?? [];
  const groups: string[] = [];
  const seen = new Set<string>();
  const addGroup = (value: unknown) => {
    const group = cleanText(value, MAX_NAME);
    if (!group) return;
    const key = normalizeKey(group);
    if (seen.has(key)) return;
    seen.add(key);
    groups.push(group);
  };
  if (Array.isArray(groupsRaw)) {
    for (const value of groupsRaw) addGroup(value);
  }
  for (const product of products) addGroup(product.group);
  if (groups.length > MAX_GROUPS) {
    return { ok: false, error: `Son demasiados grupos (máximo ${MAX_GROUPS}).` };
  }

  const summary =
    cleanText(data.summary ?? data.resumen ?? data.message ?? data.mensaje, 400) ??
    `${products.length} ${products.length === 1 ? "artículo listo" : "artículos listos"} para cargar.`;

  return { ok: true, draft: { summary, groups, products } };
}

export function importInventoryDraft(
  store: Store,
  draft: InventoryDraft,
  options: { createId: () => string },
): DraftImportResult {
  let working = store;
  const groupIds = new Map<string, string>();
  const existingGroups = new Map(
    store.groups.map((group) => [normalizeKey(group.name), group.id]),
  );

  for (const product of draft.products) {
    const key = normalizeKey(product.group);
    if (groupIds.has(key)) continue;
    const existing = existingGroups.get(key);
    if (existing) {
      groupIds.set(key, existing);
      continue;
    }
    const prefix = suggestPrefix(product.group, working.groups.map((group) => group.prefix));
    const result = saveGroup(
      working,
      { name: product.group, prefix },
      { createId: options.createId() },
    );
    if (!result.ok) return { ok: false, error: result.error };
    working = result.store;
    const created = working.groups.at(-1);
    if (!created) return { ok: false, error: "No se pudo crear el grupo." };
    groupIds.set(key, created.id);
    existingGroups.set(key, created.id);
  }

  const seen = new Set(
    working.products.map((product) =>
      [
        product.groupId,
        normalizeKey(product.name),
        product.kind,
        product.packageSize ?? "",
      ].join("|"),
    ),
  );

  let imported = 0;
  let skipped = 0;
  for (const product of draft.products) {
    const groupId = groupIds.get(normalizeKey(product.group));
    if (!groupId) {
      return { ok: false, error: `No se encontró el grupo "${product.group}".` };
    }
    const key = [
      groupId,
      normalizeKey(product.name),
      product.kind,
      product.packageSize ?? "",
    ].join("|");
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    const input: ProductInput = {
      groupId,
      name: product.name,
      kind: product.kind,
      packageSize: product.packageSize,
      priceCents: product.priceCents,
      stock: product.stock,
    };
    const result = saveProduct(working, input, { createId: options.createId() });
    if (!result.ok) return { ok: false, error: result.error };
    working = result.store;
    seen.add(key);
    imported += 1;
  }

  return { ok: true, store: working, imported, skipped };
}
