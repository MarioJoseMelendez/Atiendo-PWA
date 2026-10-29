import type {
  CartLine,
  Group,
  GroupInput,
  Product,
  ProductInput,
  Sale,
  SaleMeta,
  Store,
} from "./types";

export type Mutation =
  | { ok: true; store: Store }
  | { ok: false; error: string };

export type SaleResult =
  | { ok: true; store: Store; sale: Sale }
  | { ok: false; error: string };

const MAX_NAME = 80;
const MAX_STOCK = 100_000;
const MAX_PRICE_CENTS = 10_000_000;
const MAX_PACKAGE = 500;
const MAX_SALES = 50;

export function suggestPrefix(name: string, taken: string[]): string {
  const letters = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const base = (letters.slice(0, 2) || "AR").padEnd(2, "X");
  if (!taken.includes(base)) return base;
  const three = (letters.slice(0, 3) || `${base}X`).padEnd(3, "X");
  if (!taken.includes(three)) return three;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}${n}`.slice(0, 4);
    if (!taken.includes(candidate)) return candidate;
  }
  return "ZZ";
}

export function unitPhrase(product: Pick<Product, "kind" | "packageSize">): string {
  if (product.kind === "paquete") return `Paquete de ${product.packageSize}`;
  return "Individual";
}

export function priceSuffix(product: Pick<Product, "kind">): string {
  return product.kind === "paquete" ? "el paquete" : "la pieza";
}

export function stockPhrase(product: Pick<Product, "kind" | "stock">): string {
  if (product.stock <= 0) return "Agotado";
  if (product.kind === "paquete") {
    return product.stock === 1 ? "1 paquete" : `${product.stock} paquetes`;
  }
  return product.stock === 1 ? "1 pieza" : `${product.stock} piezas`;
}

export function isLowStock(product: Pick<Product, "stock">): boolean {
  return product.stock > 0 && product.stock <= 3;
}

export function inventoryValueCents(products: Product[]): number {
  return products.reduce((sum, product) => sum + product.priceCents * product.stock, 0);
}

export function labelSections(
  store: Store,
  groupId: string,
): { group: Group; products: Product[] }[] {
  const groups =
    groupId === "todo" ? store.groups : store.groups.filter((group) => group.id === groupId);
  const sections = groups.map((group) => ({
    group,
    products: store.products
      .filter((product) => product.groupId === group.id)
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  }));
  if (groupId === "todo") return sections.filter((section) => section.products.length > 0);
  return sections;
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().toUpperCase();
}

export function saveGroup(
  store: Store,
  input: GroupInput,
  options: { id?: string; createId: string },
): Mutation {
  const name = cleanName(input.name);
  const prefix = normalizePrefix(input.prefix);
  if (!name) return { ok: false, error: "Escribe el nombre del grupo." };
  if (name.length > MAX_NAME) {
    return { ok: false, error: "El nombre del grupo es demasiado largo." };
  }
  if (!/^[A-Z]{2,4}$/.test(prefix)) {
    return { ok: false, error: "El prefijo debe tener de 2 a 4 letras." };
  }

  const creating = !options.id;
  const id = options.id ?? options.createId;
  const clash = store.groups.some((group) => group.prefix === prefix && group.id !== id);
  if (clash) return { ok: false, error: "Ese prefijo ya lo usa otro grupo." };

  if (creating) {
    const group: Group = { id, name, prefix, nextSeq: 1 };
    return { ok: true, store: { ...store, groups: [...store.groups, group] } };
  }

  const current = store.groups.find((group) => group.id === id);
  if (!current) return { ok: false, error: "Ese grupo ya no existe." };
  return {
    ok: true,
    store: {
      ...store,
      groups: store.groups.map((group) =>
        group.id === id ? { ...group, name, prefix } : group,
      ),
    },
  };
}

export function deleteGroup(store: Store, id: string): Mutation {
  const group = store.groups.find((item) => item.id === id);
  if (!group) return { ok: false, error: "Ese grupo ya no existe." };
  const hasProducts = store.products.some((product) => product.groupId === id);
  if (hasProducts) {
    return {
      ok: false,
      error: "Pasa o borra los artículos de este grupo antes de eliminarlo.",
    };
  }
  return {
    ok: true,
    store: { ...store, groups: store.groups.filter((item) => item.id !== id) },
  };
}

export function saveProduct(
  store: Store,
  input: ProductInput,
  options: { id?: string; createId: string },
): Mutation {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Escribe el nombre del artículo." };
  if (name.length > MAX_NAME) {
    return { ok: false, error: "El nombre del artículo es demasiado largo." };
  }

  const group = store.groups.find((item) => item.id === input.groupId);
  if (!group) return { ok: false, error: "Elige un grupo que todavía exista." };

  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
    return { ok: false, error: "El precio tiene que ser mayor que cero." };
  }
  if (input.priceCents > MAX_PRICE_CENTS) {
    return { ok: false, error: "Ese precio es demasiado alto." };
  }
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > MAX_STOCK) {
    return { ok: false, error: "La existencia tiene que ser un número entre 0 y 100000." };
  }

  let packageSize: number | null = null;
  if (input.kind === "paquete") {
    if (
      input.packageSize == null ||
      !Number.isInteger(input.packageSize) ||
      input.packageSize < 2 ||
      input.packageSize > MAX_PACKAGE
    ) {
      return {
        ok: false,
        error: "Un paquete de 1 es una pieza. Indica de 2 a 500 piezas por paquete.",
      };
    }
    packageSize = input.packageSize;
  }

  const creating = !options.id;
  if (creating) {
    const code = `${group.prefix}-${String(group.nextSeq).padStart(3, "0")}`;
    const product: Product = {
      id: options.createId,
      code,
      groupId: group.id,
      name,
      kind: input.kind,
      packageSize,
      priceCents: input.priceCents,
      stock: input.stock,
    };
    return {
      ok: true,
      store: {
        ...store,
        groups: store.groups.map((item) =>
          item.id === group.id ? { ...item, nextSeq: item.nextSeq + 1 } : item,
        ),
        products: [...store.products, product],
      },
    };
  }

  const current = store.products.find((product) => product.id === options.id);
  if (!current) return { ok: false, error: "Ese artículo ya no existe." };
  const next: Product = {
    ...current,
    groupId: group.id,
    name,
    kind: input.kind,
    packageSize,
    priceCents: input.priceCents,
    stock: input.stock,
  };
  return {
    ok: true,
    store: {
      ...store,
      products: store.products.map((product) => (product.id === next.id ? next : product)),
    },
  };
}

export function deleteProduct(store: Store, id: string): Mutation {
  if (!store.products.some((product) => product.id === id)) {
    return { ok: false, error: "Ese artículo ya no existe." };
  }
  return {
    ok: true,
    store: { ...store, products: store.products.filter((product) => product.id !== id) },
  };
}

export function adjustStock(store: Store, id: string, delta: number): Mutation {
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "La existencia no cambió." };
  }
  const product = store.products.find((item) => item.id === id);
  if (!product) return { ok: false, error: "Ese artículo ya no existe." };
  const stock = Math.min(MAX_STOCK, Math.max(0, product.stock + delta));
  return {
    ok: true,
    store: {
      ...store,
      products: store.products.map((item) => (item.id === id ? { ...item, stock } : item)),
    },
  };
}

export function mergeLines(lines: CartLine[]): CartLine[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) continue;
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.qty);
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

export type QuoteRow = {
  product: Product;
  qty: number;
  lineCents: number;
  overBy: number;
};

export function quoteCart(store: Store, lines: CartLine[]): {
  rows: QuoteRow[];
  totalCents: number;
  issues: string[];
} {
  const merged = mergeLines(lines);
  const rows: QuoteRow[] = [];
  const issues: string[] = [];

  for (const line of merged) {
    const product = store.products.find((item) => item.id === line.productId);
    if (!product) {
      issues.push("Un artículo del ticket ya no está en el inventario.");
      continue;
    }
    const overBy = Math.max(0, line.qty - product.stock);
    if (product.stock <= 0) {
      issues.push(`${product.name} está agotado.`);
    } else if (overBy > 0) {
      issues.push(`${product.name}: solo quedan ${product.stock}.`);
    }
    rows.push({
      product,
      qty: line.qty,
      lineCents: product.priceCents * line.qty,
      overBy,
    });
  }

  if (rows.length === 0) issues.unshift("El ticket está vacío.");

  return {
    rows,
    totalCents: rows.reduce((sum, row) => sum + row.lineCents, 0),
    issues,
  };
}

export function applySale(
  store: Store,
  lines: CartLine[],
  tenderedCents: number,
  meta: SaleMeta,
): SaleResult {
  const quote = quoteCart(store, lines);
  if (quote.rows.length === 0 || quote.issues.length > 0) {
    return { ok: false, error: quote.issues[0] ?? "No se puede cobrar este ticket." };
  }
  if (!Number.isInteger(tenderedCents) || tenderedCents < 0) {
    return { ok: false, error: "El efectivo recibido no es válido." };
  }
  if (tenderedCents < quote.totalCents) {
    return { ok: false, error: "El efectivo no alcanza para esta venta." };
  }

  const qtyById = new Map(quote.rows.map((row) => [row.product.id, row.qty]));
  const products = store.products.map((product) => {
    const qty = qtyById.get(product.id);
    if (!qty) return product;
    return { ...product, stock: product.stock - qty };
  });

  const sale: Sale = {
    id: meta.id,
    at: meta.at,
    dayKey: meta.dayKey,
    whenLabel: meta.whenLabel,
    totalCents: quote.totalCents,
    tenderedCents,
    changeCents: tenderedCents - quote.totalCents,
    lines: quote.rows.map((row) => ({
      productId: row.product.id,
      code: row.product.code,
      name: row.product.name,
      kind: row.product.kind,
      packageSize: row.product.packageSize,
      unitCents: row.product.priceCents,
      qty: row.qty,
    })),
  };

  return {
    ok: true,
    sale,
    store: {
      ...store,
      products,
      sales: [sale, ...store.sales].slice(0, MAX_SALES),
    },
  };
}
