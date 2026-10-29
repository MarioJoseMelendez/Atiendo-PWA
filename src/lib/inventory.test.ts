import assert from "node:assert/strict";
import { describe, it } from "node:test";
import QRCode from "qrcode";
import { applySale, deleteGroup, quoteCart, saveGroup, saveProduct, suggestPrefix } from "./inventory";
import { cashSuggestions, formatQ, parseQuetzales } from "./money";
import { decodeQr, encodeQr } from "./qr";
import { createSeed } from "./seed";

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
    const seed = createSeed();
    const loose = seed.products.find((item) => item.code === "PP-001");
    const pack = seed.products.find((item) => item.code === "PP-002");
    assert.ok(loose && pack);
    assert.equal(loose.kind, "individual");
    assert.equal(loose.priceCents, 250);
    assert.equal(pack.kind, "paquete");
    assert.equal(pack.packageSize, 12);
    assert.equal(pack.priceCents, 2400);
    assert.notEqual(loose.priceCents * 12, pack.priceCents);
  });

  it("asigna un código nuevo y no reutiliza el del artículo borrado", () => {
    const seed = createSeed();
    const created = saveProduct(
      seed,
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
      createSeed(),
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
    const seed = createSeed();
    const pencil = seed.products.find((item) => item.code === "PP-002");
    assert.ok(pencil);
    const blocked = applySale(
      seed,
      [{ productId: pencil.id, qty: 1 }],
      1000,
      { id: "s1", at: "2026-10-29T18:00:00.000Z", dayKey: "2026-10-29", whenLabel: "29 oct, 12:00" },
    );
    assert.equal(blocked.ok, false);

    const paid = applySale(
      seed,
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
    assert.equal(seed.products.find((item) => item.id === pencil.id)?.stock, 15);
  });

  it("no deja vender de más", () => {
    const seed = createSeed();
    const rayuela = seed.products.find((item) => item.code === "NV-005");
    assert.ok(rayuela);
    const quote = quoteCart(seed, [{ productId: rayuela.id, qty: 1 }]);
    assert.match(quote.issues.join(" "), /agotado/i);
    const sale = applySale(seed, [{ productId: rayuela.id, qty: 1 }], 20000, {
      id: "s3",
      at: "2026-10-29T18:00:00.000Z",
      dayKey: "2026-10-29",
      whenLabel: "29 oct",
    });
    assert.equal(sale.ok, false);
  });

  it("no borra un grupo con artículos", () => {
    const result = deleteGroup(createSeed(), "g-papeleria");
    assert.equal(result.ok, false);
  });

  it("crea un grupo con prefijo propio", () => {
    const result = saveGroup(createSeed(), { name: "Mapas", prefix: "MP" }, { createId: "g-mapas" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.store.groups.at(-1)?.prefix, "MP");
  });
});
