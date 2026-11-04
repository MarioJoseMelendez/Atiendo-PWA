import { isProvider, providerOrder, type Provider } from "@/lib/ai";
import {
  BUSINESS_SYSTEM_PROMPT,
  INVENTORY_SYSTEM_PROMPT,
  storeContext,
} from "@/lib/ai-prompts";
import {
  completeChat,
  PROVIDERS,
  providerModel,
  resolveProviderKeys,
  type ChatTurn,
} from "@/lib/ai-server";
import { businessContext } from "@/lib/business-context";
import {
  isChatScope,
  MAX_CHAT_CONTENT,
  type ChatMessage,
  type ChatScope,
} from "@/lib/chat";
import { parseInventoryDraft } from "@/lib/import";
import { appendChatMessages, clearChatMessages, getDb } from "@/lib/server-db";


const MAX_HISTORY = 12;

type ChatBody = {
  scope?: unknown;
  message?: unknown;
  provider?: unknown;
};

function newMessage(
  role: "user" | "assistant",
  content: string,
  extra?: { provider?: Provider; model?: string },
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    at: new Date().toISOString(),
    ...extra,
  };
}

function scopeFrom(request: Request): ChatScope | null {
  const value = new URL(request.url).searchParams.get("scope") ?? "business";
  return isChatScope(value) ? value : null;
}

export async function GET(request: Request) {
  const scope = scopeFrom(request);
  if (!scope) {
    return Response.json({ ok: false, error: "El chat no es válido." }, { status: 400 });
  }
  const db = await getDb();
  return Response.json(
    { ok: true, messages: db.chats[scope] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const scope = scopeFrom(request);
  if (!scope) {
    return Response.json({ ok: false, error: "El chat no es válido." }, { status: 400 });
  }
  await clearChatMessages(scope);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return Response.json({ ok: false, error: "La solicitud no es válida." }, { status: 400 });
  }

  if (!isChatScope(body.scope)) {
    return Response.json({ ok: false, error: "El chat no es válido." }, { status: 400 });
  }
  const scope = body.scope;
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) {
    return Response.json({ ok: false, error: "Escribe un mensaje." }, { status: 400 });
  }
  if (text.length > MAX_CHAT_CONTENT) {
    return Response.json(
      { ok: false, error: "El mensaje es demasiado largo." },
      { status: 413 },
    );
  }

  const db = await getDb();
  const keys = resolveProviderKeys({}, db.keys);
  const preferred: Provider = isProvider(body.provider) ? body.provider : "openrouter";
  const available = providerOrder(preferred, keys);

  if (available.length === 0) {
    return Response.json(
      {
        ok: false,
        code: "no-keys",
        error:
          "Falta una clave de IA. Configura NVIDIA u OpenRouter en Claves y carga avanzada.",
      },
      { status: 503 },
    );
  }

  const messages: ChatTurn[] =
    scope === "inventory"
      ? [
          { role: "system", content: INVENTORY_SYSTEM_PROMPT },
          { role: "user", content: `${text}\n\n${storeContext(db.store)}` },
        ]
      : [
          {
            role: "system",
            content: `${BUSINESS_SYSTEM_PROMPT}\n\nContexto actual del negocio:\n${businessContext(db.store)}`,
          },
          ...db.chats[scope].slice(-MAX_HISTORY).map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: "user", content: text },
        ];

  const errors: string[] = [];
  for (const provider of available) {
    const model = providerModel(provider);
    const result = await completeChat(provider, keys[provider], model, messages, request, {
      temperature: scope === "business" ? 0.4 : 0.2,
      maxTokens: scope === "business" ? 1200 : 2048,
    });
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }

    if (scope === "business") {
      const reply = result.content.trim();
      if (!reply) {
        errors.push(`${PROVIDERS[provider].label} no devolvió una respuesta.`);
        continue;
      }
      await appendChatMessages(scope, [
        newMessage("user", text),
        newMessage("assistant", reply, { provider, model }),
      ]);
      return Response.json({
        ok: true,
        reply,
        provider,
        model,
        fallback: provider !== preferred,
      });
    }

    const parsed = parseInventoryDraft(result.content);
    if (!parsed.ok) {
      errors.push(`${PROVIDERS[provider].label}: ${parsed.error}`);
      continue;
    }
    const reply = parsed.draft.summary;
    await appendChatMessages(scope, [
      newMessage("user", text),
      newMessage("assistant", reply, { provider, model }),
    ]);
    return Response.json({
      ok: true,
      reply,
      draft: parsed.draft,
      provider,
      model,
      fallback: provider !== preferred,
    });
  }

  return Response.json(
    { ok: false, error: `No se pudo responder. ${errors.join(" ")}` },
    { status: 502 },
  );
}
