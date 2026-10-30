import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProvider, maskKey, providerOrder, publicKeyStatuses } from "./ai";

describe("proveedores de IA", () => {
  it("prefiere OpenRouter y deja NVIDIA como respaldo", () => {
    assert.deepEqual(
      providerOrder("openrouter", { openrouter: "sk-or", nvidia: "nvapi" }),
      ["openrouter", "nvidia"],
    );
  });

  it("prefiere NVIDIA y deja OpenRouter como respaldo", () => {
    assert.deepEqual(
      providerOrder("nvidia", { openrouter: "sk-or", nvidia: "nvapi" }),
      ["nvidia", "openrouter"],
    );
  });

  it("solo usa el proveedor que tiene clave", () => {
    assert.deepEqual(providerOrder("openrouter", { openrouter: "", nvidia: "nvapi" }), [
      "nvidia",
    ]);
    assert.deepEqual(providerOrder("nvidia", { openrouter: "sk-or", nvidia: "" }), [
      "openrouter",
    ]);
    assert.deepEqual(providerOrder("nvidia", { openrouter: "", nvidia: "" }), []);
  });

  it("reconoce los proveedores válidos", () => {
    assert.equal(isProvider("nvidia"), true);
    assert.equal(isProvider("openrouter"), true);
    assert.equal(isProvider("otro"), false);
  });

  it("muestra solo el final de una clave guardada", () => {
    assert.equal(maskKey("nvapi-1234567890"), "••••7890");
    assert.equal(maskKey("corta"), "••••");
    assert.deepEqual(publicKeyStatuses({ nvidia: "nvapi-1234567890" }), {
      nvidia: { configured: true, hint: "••••7890" },
      openrouter: { configured: false, hint: "" },
    });
  });
});
