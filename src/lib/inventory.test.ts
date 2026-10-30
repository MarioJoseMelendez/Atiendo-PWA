import assert from "node:assert/strict";
import { describe, it } from "node:test";
import QRCode from "qrcode";
import { importInventoryDraft, parseInventoryDraft } from "./import";
import { applySale, deleteGroup, quoteCart, saveGroup, saveProduct, suggestPrefix } from "./inventory";
import { cashSuggestions, formatQ, parseQuetzales } from "./money";
import { createEmptyStore } from "./empty-store";
import { decodeQr, encodeQr } from "./qr";
import type { Store } from "./types";

function makeStore(): Store {
  return {
    version: 1,
    groups: [
      { id: "g-novela", name: "Novela y cuento", prefix: "NV", nextSeq: 6 },
      { id: "g-papeleria", name: "Papelería", prefix: "PP", nextSeq: 3 },
    ],
    products: [
      {
        id: "p-nv-005",
        code: "NV-005",
        groupId: "g-novela",
        name: "Rayuela",
        kind: "individual",
        packageSize: null,
        priceCents: 12800,
        stock: 0,
      },
      {
        id: "p-pp-001",
        code: "PP-001",
        groupId: "g-papeleria",
        name: "Lápiz Mongol",
        kind: "individual",
        packageSize: null,
        priceCents: 250,
        stock: 48,
      },
      {
        id: "p-pp-002",
        code: "PP-002",
        groupId: "g-papeleria",
        name: "Lápiz Mongol",
        kind: "paquete",
        packageSize: 12,
        priceCents: 2400,
        stock: 15,
      },
    ],
    sales: [],
  };
}

describe("dinero", () => {
  it("lee quetzales con punto, coma o símbolo", () => {
    assert.equal(parseQuetzales("24"), 2400);
    assert.equal(parseQuetzales("24.5"), 2450);
    assert.equal(parseQuetzales("24,50"), 2450);
    assert.equal(parseQuetzales("Q24.50"), 2450);
    assert.equal(parseQuetzales("1,234.50"), 123450);
    assert.equal(parseQuetzales(""), null);
    assert.equal(parseQuetzales("abc"), null);
    assert.equal(parseQuetzales("-1"), null);
  });

  it("formatea con Q", () => {
    assert.equal(formatQ(2450), "Q24.50");
  });

  it("sugiere billetes por encima del total", () => {
    const amounts = cashSuggestions(2450);
    assert.equal(amounts[0], 2450);
    assert.ok(amounts.includes(3000));
  });
});

describe("qr", () => {
  it("acepta el código de la librería y rechaza otros", () => {
    assert.equal(decodeQr(encodeQr("nv-001")), "NV-001");
    assert.equal(decodeQr("PP-002"), "PP-002");
    assert.equal(decodeQr("estante:PP-002"), "PP-002");
    assert.equal(decodeQr("https://ejemplo.test"), null);
    assert.equal(decodeQr("estante:"), null);
  });

  it("dibuja un svg", async () => {
    const svg = await QRCode.toString(encodeQr("NV-001"), { type: "svg", margin: 1 });
    assert.match(svg, /<svg/);
  });
});

describe("inventario", () => {
  it("sugiere un prefijo libre", () => {
    assert.equal(suggestPrefix("Papelería", []), "PA");
    assert.equal(suggestPrefix("Papelería", ["PA"]), "PAP");
  });

  it("distingue el precio del paquete y el de la pieza", () => {
    const store = makeStore();
    const loose = store.products.find((item) => item.code === "PP-001");
    const pack = store.products.find((item) => item.code === "PP-002");
    assert.ok(loose && pack);
    assert.equal(loose.kind, "individual");
    assert.equal(loose.priceCents, 250);
    assert.equal(pack.kind, "paquete");
    assert.equal(pack.packageSize, 12);
    assert.equal(pack.priceCents, 2400);
    assert.notEqual(loose.priceCents * 12, pack.priceCents);
  });

  it("asigna un código nuevo y no reutiliza el del artículo borrado", () => {
    const store = makeStore();
    const created = saveProduct(
      store,
      {
        groupId: "g-novela",
        name: "Pedro Páramo",
        kind: "individual",
        packageSize: null,
        priceCents: 8900,
        stock: 2,
      },
      { createId: "p-new" },
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const product = created.store.products.find((item) => item.id === "p-new");
    assert.equal(product?.code, "NV-006");
    assert.equal(created.store.groups.find((group) => group.id === "g-novela")?.nextSeq, 7);
  });

  it("exige el tamaño del paquete", () => {
    const result = saveProduct(
      makeStore(),
      {
        groupId: "g-papeleria",
        name: "Clips",
        kind: "paquete",
        packageSize: 1,
        priceCents: 500,
        stock: 1,
      },
      { createId: "p-clips" },
    );
    assert.equal(result.ok, false);
  });

  it("cobra en efectivo y descuenta existencias", () => {
    const store = makeStore();
    const pencil = store.products.find((item) => item.code === "PP-002");
    assert.ok(pencil);
    const blocked = applySale(
      store,
      [{ productId: pencil.id, qty: 1 }],
      1000,
      { id: "s1", at: "2026-10-29T18:00:00.000Z", dayKey: "2026-10-29", whenLabel: "29 oct, 12:00" },
    );
    assert.equal(blocked.ok, false);

    const paid = applySale(
      store,
      [{ productId: pencil.id, qty: 2 }],
      5000,
      { id: "s2", at: "2026-10-29T18:00:00.000Z", dayKey: "2026-10-29", whenLabel: "29 oct, 12:00" },
    );
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.sale.totalCents, 4800);
    assert.equal(paid.sale.changeCents, 200);
    assert.equal(paid.sale.lines[0]?.kind, "paquete");
    assert.equal(paid.sale.lines[0]?.packageSize, 12);
    const left = paid.store.products.find((item) => item.id === pencil.id);
    assert.equal(left?.stock, 13);
    assert.equal(store.products.find((item) => item.id === pencil.id)?.stock, 15);
  });

  it("no deja vender de más", () => {
    const store = makeStore();
    const rayuela = store.products.find((item) => item.code === "NV-005");
    assert.ok(rayuela);
    const quote = quoteCart(store, [{ productId: rayuela.id, qty: 1 }]);
    assert.match(quote.issues.join(" "), /agotado/i);
    const sale = applySale(store, [{ productId: rayuela.id, qty: 1 }], 20000, {
      id: "s3",
      at: "2026-10-29T18:00:00.000Z",
      dayKey: "2026-10-29",
      whenLabel: "29 oct",
    });
    assert.equal(sale.ok, false);
  });

  it("no borra un grupo con artículos", () => {
    const result = deleteGroup(makeStore(), "g-papeleria");
    assert.equal(result.ok, false);
  });

  it("crea un grupo con prefijo propio", () => {
    const result = saveGroup(makeStore(), { name: "Mapas", prefix: "MP" }, { createId: "g-mapas" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.store.groups.at(-1)?.prefix, "MP");
  });
});

describe("carga rápida con IA", () => {
  it("lee el borrador aunque venga con markdown y precios en quetzales", () => {
    const raw = [
      "```json",
      JSON.stringify({
        summary: "Dos presentaciones",
        groups: ["Papelería"],
        products: [
          {
            group: "Papelería",
            name: "Hoja carta",
            kind: "individual",
            packageSize: null,
            price: 0.25,
            stock: 300,
          },
          {
            group: "Papelería",
            name: "Hoja carta",
            kind: "paquete",
            packageSize: 100,
            priceCents: 2000,
            stock: 5,
          },
        ],
      }),
      "```",
    ].join("\n");
    const result = parseInventoryDraft(raw);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.draft.products.length, 2);
    assert.equal(result.draft.products[0]?.priceCents, 25);
    assert.equal(result.draft.products[1]?.priceCents, 2000);
  });

  it("rechaza un paquete sin tamaño", () => {
    const result = parseInventoryDraft(
      JSON.stringify({
        products: [
          { group: "Papelería", name: "Clips", kind: "paquete", priceCents: 500, stock: 1 },
        ],
      }),
    );
    assert.equal(result.ok, false);
  });

  it("carga pieza y ciento en un grupo nuevo y evita duplicados", () => {
    const draft = {
      summary: "Hojas",
      groups: ["Hojas y sobres"],
      products: [
        {
          group: "Hojas y sobres",
          name: "Hoja carta",
          kind: "individual" as const,
          packageSize: null,
          priceCents: 25,
          stock: 300,
        },
        {
          group: "Hojas y sobres",
          name: "Hoja carta",
          kind: "paquete" as const,
          packageSize: 100,
          priceCents: 2000,
          stock: 5,
        },
      ],
    };
    let seq = 0;
    const first = importInventoryDraft(createEmptyStore(), draft, { createId: () => `id-${++seq}` });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.imported, 2);
    assert.equal(first.skipped, 0);
    const group = first.store.groups.find((item) => item.name === "Hojas y sobres");
    assert.ok(group);
    const codes = first.store.products
      .filter((product) => product.groupId === group.id)
      .map((product) => product.code);
    assert.deepEqual(codes, ["HO-001", "HO-002"]);

    const second = importInventoryDraft(first.store, draft, { createId: () => `id-${++seq}` });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.imported, 0);
    assert.equal(second.skipped, 2);
  });
});
