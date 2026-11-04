import assert from "node:assert/strict";
import test from "node:test";
import { businessContext } from "./business-context";
import { guatemalaDayKey } from "./dates";
import type { Sale, Store } from "./types";

const sale: Sale = {
  id: "s1",
  at: "2026-01-01T12:00:00.000Z",
  dayKey: guatemalaDayKey(new Date()),
  whenLabel: "hoy",
  lines: [
    {
      productId: "p1",
      code: "PP-001",
      name: "Cuaderno",
      kind: "individual",
      packageSize: null,
      unitCents: 1800,
      qty: 2,
    },
  ],
  totalCents: 3600,
  tenderedCents: 5000,
  changeCents: 1400,
};

const store: Store = {
  version: 1,
  groups: [{ id: "g1", name: "Papelería", prefix: "PP", nextSeq: 4 }],
  products: [
    {
      id: "p1",
      code: "PP-001",
      groupId: "g1",
      name: "Cuaderno",
      kind: "individual",
      packageSize: null,
      priceCents: 1800,
      stock: 2,
    },
    {
      id: "p2",
      code: "PP-002",
      groupId: "g1",
      name: "Lápiz",
      kind: "individual",
      packageSize: null,
      priceCents: 250,
      stock: 0,
    },
  ],
  sales: [sale],
};

test("el contexto del negocio incluye inventario, ventas y alertas", () => {
  const context = businessContext(store);

  assert.match(context, /Papelería \(PP\)/);
  assert.match(context, /Cuaderno/);
  assert.match(context, /Lápiz/);
  assert.match(context, /Q36\.00/);
  assert.match(context, /Existencia baja \(1-3\): Cuaderno/);
  assert.match(context, /Agotados: Lápiz/);
  assert.match(context, /Más vendidos por ingreso: Cuaderno/);
});

test("el contexto vacío lo dice sin inventar datos", () => {
  const context = businessContext(null);
  assert.match(context, /Todavía no hay inventario/);
});
