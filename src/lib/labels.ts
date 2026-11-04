import { unitPhrase } from "./inventory";
import { formatQ } from "./money";
import type { Product, Store } from "./types";

export type LabelScope = "all" | "group" | "product";
export type LabelFormat = "pdf" | "docx";

export type LabelSection = {
  groupName: string;
  products: Product[];
};

export type LabelSheet = {
  title: string;
  subtitle: string;
  sections: LabelSection[];
  products: Product[];
  fileBase: string;
};

export function isLabelScope(value: unknown): value is LabelScope {
  return value === "all" || value === "group" || value === "product";
}

export function isLabelFormat(value: unknown): value is LabelFormat {
  return value === "pdf" || value === "docx";
}

function slug(value: string): string {
  const text = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return text || "etiquetas";
}

function byName(a: Product, b: Product): number {
  return a.name.localeCompare(b.name, "es");
}

export function labelSheet(
  store: Store,
  scope: LabelScope,
  id?: string | null,
): LabelSheet | null {
  if (scope === "product") {
    const product = store.products.find((item) => item.id === id);
    if (!product) return null;
    const group = store.groups.find((item) => item.id === product.groupId);
    return {
      title: product.name,
      subtitle: `${unitPhrase(product)} · ${formatQ(product.priceCents)} · ${product.code}`,
      sections: [{ groupName: group?.name ?? "Sin grupo", products: [product] }],
      products: [product],
      fileBase: `atiendo-etiqueta-${slug(product.code)}`,
    };
  }

  if (scope === "group") {
    const group = store.groups.find((item) => item.id === id);
    if (!group) return null;
    const products = store.products
      .filter((product) => product.groupId === group.id)
      .sort(byName);
    return {
      title: group.name,
      subtitle: `${products.length} ${products.length === 1 ? "etiqueta" : "etiquetas"} · prefijo ${group.prefix}`,
      sections: [{ groupName: group.name, products }],
      products,
      fileBase: `atiendo-etiquetas-${slug(group.name)}`,
    };
  }

  const sections = store.groups
    .map((group) => ({
      groupName: group.name,
      products: store.products
        .filter((product) => product.groupId === group.id)
        .sort(byName),
    }))
    .filter((section) => section.products.length > 0)
    .sort((a, b) => a.groupName.localeCompare(b.groupName, "es"));
  const products = sections.flatMap((section) => section.products);
  return {
    title: "Todo el inventario",
    subtitle: `${products.length} ${products.length === 1 ? "etiqueta" : "etiquetas"} · ${sections.length} ${sections.length === 1 ? "tipo" : "tipos"}`,
    sections,
    products,
    fileBase: "atiendo-etiquetas-todo",
  };
}

export function labelFileName(sheet: LabelSheet, format: LabelFormat): string {
  return `${sheet.fileBase}.${format}`;
}
