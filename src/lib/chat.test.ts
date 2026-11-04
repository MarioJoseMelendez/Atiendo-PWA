import assert from "node:assert/strict";
import test from "node:test";
import {
  appendChat,
  clearChat,
  emptyChats,
  MAX_CHAT_CONTENT,
  MAX_CHAT_MESSAGES,
  readChatMessage,
  readChats,
  type ChatMessage,
} from "./chat";

function message(index: number): ChatMessage {
  return {
    id: `m${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `mensaje ${index}`,
    at: new Date(2026, 0, 1, 0, index).toISOString(),
  };
}

test("readChats ignora datos inválidos y conserva los válidos", () => {
  const chats = readChats({
    business: [
      { id: "1", role: "user", content: "Hola", at: "2026-01-01T00:00:00.000Z" },
      { id: "2", role: "system", content: "No", at: "2026-01-01T00:00:00.000Z" },
      { id: "3", role: "assistant", content: "  ", at: "2026-01-01T00:00:00.000Z" },
    ],
    inventory: "no es una lista",
  });

  assert.equal(chats.business.length, 1);
  assert.equal(chats.business[0].content, "Hola");
  assert.equal(chats.inventory.length, 0);
});

test("readChatMessage conserva proveedor y modelo", () => {
  const parsed = readChatMessage({
    id: "1",
    role: "assistant",
    content: "Respuesta",
    at: "2026-01-01T00:00:00.000Z",
    provider: "openrouter",
    model: "openrouter/auto",
  });

  assert.ok(parsed);
  assert.equal(parsed.provider, "openrouter");
  assert.equal(parsed.model, "openrouter/auto");
});

test("readChatMessage recorta mensajes demasiado largos", () => {
  const parsed = readChatMessage({
    id: "1",
    role: "user",
    content: "x".repeat(MAX_CHAT_CONTENT + 50),
    at: "2026-01-01T00:00:00.000Z",
  });

  assert.ok(parsed);
  assert.equal(parsed.content.length, MAX_CHAT_CONTENT);
});

test("appendChat conserva solo los últimos mensajes", () => {
  const chats = emptyChats();
  const many = Array.from({ length: MAX_CHAT_MESSAGES + 5 }, (_, index) => message(index));
  const next = appendChat(chats, "business", many);

  assert.equal(next.business.length, MAX_CHAT_MESSAGES);
  assert.equal(next.business[0].id, "m5");
  assert.equal(next.inventory.length, 0);
});

test("clearChat vacía solo el chat indicado", () => {
  const chats = appendChat(emptyChats(), "business", [message(0)]);
  const withInventory = appendChat(chats, "inventory", [message(1)]);
  const cleared = clearChat(withInventory, "business");

  assert.equal(cleared.business.length, 0);
  assert.equal(cleared.inventory.length, 1);
});
