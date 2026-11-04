import { guatemalaDayKey } from "./dates";
import { unitPhrase } from "./inventory";
import { formatQ } from "./money";
import type { Store } from "./types";

const MAX_PRODUCTS = 120;
const MAX_TOP = 5;

function sumSales(store: Store, days: Set<string> | null): number {
  return store.sales
    .filter((sale) => (days ? days.has(sale.dayKey) : true))
    .reduce((sum, sale) => sum + sale.totalCents, 0);
}

export function businessContext(store: Store | null): string {
  if (!store) return "Todavía no hay inventario ni ventas registradas.";

  const today = guatemalaDayKey(new Date());
  const lastWeek = new Set(
    Array.from({ length: 7 }, (_, index) =>
      guatemalaDayKey(new Date(Date.now() - index * 86_400_000)),
    ),
  );
  const todaySales = store.sales
    .filter((sale) => sale.dayKey === today)
    .reduce((sum, sale) => sum + sale.totalCents, 0);
  const weekSales = sumSales(store, lastWeek);
  const totalSales = sumSales(store, null);

  const byProduct = new Map<string, { name: string; code: string; revenue: number; qty: number }>();
  for (const sale of store.sales) {
    for (const line of sale.lines) {
      const key = line.code || line.name;
      const current = byProduct.get(key) ?? {
        name: line.name,
        code: line.code,
        revenue: 0,
        qty: 0,
      };
      current.revenue += line.unitCents * line.qty;
      current.qty += line.qty;
      byProduct.set(key, current);
    }
  }
  const top = [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, MAX_TOP);

  const groups = store.groups.map((group) => `${group.name} (${group.prefix})`);
  const products = store.products.slice(0, MAX_PRODUCTS).map((product) => {
    const group = store.groups.find((item) => item.id === product.groupId)?.name ?? "Sin grupo";
    return `- ${product.code} · ${product.name} · ${group} · ${unitPhrase(product)} · ${formatQ(product.priceCents)} · ${product.stock} en existencia`;
  });
  const extra =
    store.products.length > MAX_PRODUCTS
      ? `\n… y ${store.products.length - MAX_PRODUCTS} artículos más.`
      : "";

  const low = store.products
    .filter((product) => product.stock > 0 && product.stock <= 3)
    .map((product) => product.name);
  const out = store.products
    .filter((product) => product.stock <= 0)
    .map((product) => product.name);
  const value = store.products.reduce(
    (sum, product) => sum + product.priceCents * product.stock,
    0,
  );

  return [
    `Negocio: librería en Guatemala. Moneda: quetzal (Q). Hoy: ${today}.`,
    `Grupos: ${groups.join(", ") || "(ninguno)"}.`,
    `Inventario: ${store.products.length} artículos; valor ${formatQ(value)}.`,
    "Artículos:",
    ...products,
    extra,
    `Agotados: ${out.join(", ") || "ninguno"}.`,
    `Existencia baja (1-3): ${low.join(", ") || "ninguno"}.`,
    `Ventas guardadas: hoy ${formatQ(todaySales)}; últimos 7 días ${formatQ(weekSales)}; total ${formatQ(totalSales)} en ${store.sales.length} ventas.`,
    `Más vendidos por ingreso: ${
      top.map((item) => `${item.name} (${item.code}) ${formatQ(item.revenue)}`).join(", ") ||
      "sin ventas"
    }.`,
  ].join("\n");
}
