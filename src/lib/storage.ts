import { createSeed } from "./seed";
import type { Group, Product, Sale, SaleKind, Store } from "./types";

const KEY = "estante.v1";

function isKind(value: unknown): value is SaleKind {
  return value === "individual" || value === "paquete";
}

function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") return false;
  const group = value as Group;
  return (
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    typeof group.prefix === "string" &&
    Number.isInteger(group.nextSeq)
  );
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Product;
  return (
    typeof product.id === "string" &&
    typeof product.code === "string" &&
    typeof product.groupId === "string" &&
    typeof product.name === "string" &&
    isKind(product.kind) &&
    (product.packageSize === null || Number.isInteger(product.packageSize)) &&
    Number.isInteger(product.priceCents) &&
    Number.isInteger(product.stock)
  );
}

function isSale(value: unknown): value is Sale {
  if (!value || typeof value !== "object") return false;
  const sale = value as Sale;
  return (
    typeof sale.id === "string" &&
    typeof sale.at === "string" &&
    typeof sale.dayKey === "string" &&
    typeof sale.whenLabel === "string" &&
    Array.isArray(sale.lines) &&
    Number.isInteger(sale.totalCents) &&
    Number.isInteger(sale.tenderedCents) &&
    Number.isInteger(sale.changeCents)
  );
}

export function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const store = value as Store;
  return (
    store.version === 1 &&
    Array.isArray(store.groups) &&
    store.groups.every(isGroup) &&
    Array.isArray(store.products) &&
    store.products.every(isProduct) &&
    Array.isArray(store.sales) &&
    store.sales.every(isSale)
  );
}

export function loadStore(): Store | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function storeOrSeed(value: unknown): Store {
  return isStore(value) ? value : createSeed();
}
