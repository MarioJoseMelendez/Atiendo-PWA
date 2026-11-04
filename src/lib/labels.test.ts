import assert from "node:assert/strict";
import test from "node:test";
import { labelFileName, labelSheet } from "./labels";
import type { Store } from "./types";

const store: Store = {
  version: 1,
  groups: [
    { id: "g1", name: "Papelería", prefix: "PP", nextSeq: 4 },
    { id: "g2", name: "Novela", prefix: "NV", nextSeq: 2 },
  ],
  products: [
    {
      id: "p1",
      code: "PP-001",
      groupId: "g1",
      name: "Lápiz Mongol individual",
      kind: "individual",
      packageSize: null,
      priceCents: 250,
      stock: 48,
    },
    {
      id: "p2",
      code: "PP-002",
      groupId: "g1",
      name: "Lápiz Mongol paquete",
      kind: "paquete",
      packageSize: 12,
      priceCents: 2400,
      stock: 15,
    },
    {
      id: "p3",
      code: "NV-001",
      groupId: "g2",
      name: "Rayuela",
      kind: "individual",
      packageSize: null,
      priceCents: 12800,
      stock: 3,
    },
  ],
  sales: [],
};

test("todo el inventario separa paquetes e individuales", () => {
  const sheet = labelSheet(store, "all");
  assert.ok(sheet);
  assert.equal(sheet.products.length, 3);
  assert.deepEqual(
    new Set(sheet.products.map((product) => product.code)),
    new Set(["PP-001", "PP-002", "NV-001"]),
  );
  assert.equal(sheet.sections.length, 2);
  assert.equal(labelFileName(sheet, "pdf"), "atiendo-etiquetas-todo.pdf");
});

test("por tipo incluye solo los productos del grupo", () => {
  const sheet = labelSheet(store, "group", "g1");
  assert.ok(sheet);
  assert.equal(sheet.title, "Papelería");
  assert.equal(sheet.products.length, 2);
  assert.equal(labelFileName(sheet, "docx"), "atiendo-etiquetas-papeleria.docx");
});

test("por producto distingue el paquete del individual", () => {
  const sheet = labelSheet(store, "product", "p2");
  assert.ok(sheet);
  assert.equal(sheet.products.length, 1);
  assert.match(sheet.subtitle, /Paquete de 12/);
  assert.match(sheet.subtitle, /PP-002/);
  assert.equal(labelFileName(sheet, "pdf"), "atiendo-etiqueta-pp-002.pdf");
});

test("un grupo o producto inexistente no genera hoja", () => {
  assert.equal(labelSheet(store, "group", "nope"), null);
  assert.equal(labelSheet(store, "product", "nope"), null);
});

test("un inventario vacío genera una hoja sin etiquetas", () => {
  const sheet = labelSheet({ ...store, groups: [], products: [] }, "all");
  assert.ok(sheet);
  assert.equal(sheet.products.length, 0);
  assert.equal(sheet.sections.length, 0);
});
