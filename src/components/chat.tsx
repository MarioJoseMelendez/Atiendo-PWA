"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useInventory } from "@/components/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isProvider, type Provider } from "@/lib/ai";
import { readChatMessage, type ChatMessage, type ChatScope } from "@/lib/chat";
import type { InventoryDraft } from "@/lib/import";
import { unitPhrase } from "@/lib/inventory";
import { formatQ } from "@/lib/money";
import { pushStore } from "@/lib/remote";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<Provider, string> = {
  nvidia: "NVIDIA",
  openrouter: "OpenRouter",
};

type ChatResponse =
  | {
      ok: true;
      reply: string;
      provider: Provider;
      model: string;
      fallback: boolean;
      draft?: InventoryDraft;
    }
  | { ok: false; error: string; code?: string };

function isChatResponse(value: unknown): value is ChatResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.ok === true) {
    return (
      typeof record.reply === "string" &&
      isProvider(record.provider) &&
      typeof record.model === "string" &&
      typeof record.fallback === "boolean"
    );
  }
  return record.ok === false && typeof record.error === "string";
}

type ChatPanelProps = {
  scope: ChatScope;
  title: string;
  description: string;
  placeholder: string;
  empty: string;
  examples?: string[];
};

function ChatPanel({
  scope,
  title,
  description,
  placeholder,
  empty,
  examples,
}: ChatPanelProps) {
  const { ready, store, importDraft } = useInventory();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<InventoryDraft | null>(null);
  const [used, setUsed] = useState<{ provider: Provider; fallback: boolean } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/chat?scope=${scope}`, { cache: "no-store" });
        if (!response.ok) throw new Error("load");
        const payload: unknown = await response.json();
        if (cancelled) return;
        const record = payload as { ok?: unknown; messages?: unknown };
        if (record.ok === true && Array.isArray(record.messages)) {
          setMessages(
            record.messages
              .map(readChatMessage)
              .filter((message): message is ChatMessage => message !== null),
          );
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar el chat guardado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, busy]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!ready || !text || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setDraft(null);
    setUsed(null);
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    await pushStore(store);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, message: text }),
      });
      const payload: unknown = await response.json();
      if (!isChatResponse(payload)) {
        setError("El servidor devolvió una respuesta inesperada.");
        return;
      }
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      const assistant: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.reply,
        at: new Date().toISOString(),
        provider: payload.provider,
        model: payload.model,
      };
      setMessages((prev) => [...prev, assistant]);
      if (scope === "inventory" && payload.draft) {
        setDraft(payload.draft);
        setUsed({ provider: payload.provider, fallback: payload.fallback });
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  async function clear() {
    if (!window.confirm("¿Borrar este chat? Los mensajes no se pueden recuperar.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat?scope=${scope}`, { method: "DELETE" });
      if (!response.ok) {
        setError("No se pudo limpiar el chat.");
        return;
      }
      setMessages([]);
      setDraft(null);
      setUsed(null);
      setNotice(null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  function loadDraft() {
    if (!draft) return;
    const result = importDraft(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const parts = [
      result.imported === 0
        ? "No había artículos nuevos."
        : `Se cargaron ${result.imported} ${
            result.imported === 1 ? "artículo" : "artículos"
          }.`,
    ];
    if (result.skipped > 0) {
      parts.push(
        `Se omitieron ${result.skipped} ${
          result.skipped === 1 ? "repetido" : "repetidos"
        }.`,
      );
    }
    setNotice(parts.join(" "));
    setDraft(null);
    setUsed(null);
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-card/70 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void clear()}
          disabled={busy || messages.length === 0}
        >
          <Trash2 />
          Limpiar
        </Button>
      </header>

      <div
        ref={listRef}
        className="grid max-h-[26rem] gap-3 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : messages.length === 0 ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">{empty}</p>
            {examples?.length ? (
              <div className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInput(example)}
                    className="rounded-full border border-border px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {message.content}
            </div>
          ))
        )}
        {busy ? <p className="text-sm text-muted-foreground">Pensando…</p> : null}
      </div>

      {error ? (
        <p
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="grid gap-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Revisa antes de cargar</p>
            {used ? (
              <Badge variant="secondary">
                <Sparkles />
                {PROVIDER_LABEL[used.provider]}
                {used.fallback ? " (respaldo)" : ""}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{draft.summary}</p>
          <ul className="grid gap-1 text-sm">
            {draft.products.slice(0, 6).map((product, index) => (
              <li
                key={`${product.name}-${product.kind}-${index}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>
                  {product.name} · {unitPhrase(product)}
                </span>
                <span className="text-muted-foreground">
                  {formatQ(product.priceCents)} · {product.stock}
                </span>
              </li>
            ))}
            {draft.products.length > 6 ? (
              <li className="text-xs text-muted-foreground">
                … y {draft.products.length - 6} más.
              </li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={loadDraft}>
              Cargar {draft.products.length}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setUsed(null);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="text-sm text-[#1e3d32]" role="status">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={2}
          className="min-h-16 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={title}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Enter envía · Shift+Enter hace una línea nueva
          </p>
          <Button
            type="button"
            onClick={() => void send(input)}
            disabled={busy || !ready || input.trim().length === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ChatPage() {
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Chat</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Arriba, para hablar del negocio. Abajo, para agregar artículos al inventario.
          </p>
        </div>
        <Link
          href="/cargar"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Claves y carga avanzada
        </Link>
      </header>

      <ChatPanel
        scope="business"
        title="Hablar del negocio"
        description="Pregunta por ventas, precios, compras o ideas. El chat conoce tu inventario actual."
        placeholder="¿Qué debería reponer primero?"
        empty="Todavía no hay mensajes. Pregunta lo que quieras sobre el negocio."
        examples={[
          "¿Qué debería reponer primero?",
          "¿Cómo van las ventas de hoy?",
          "¿Qué precio le pongo a los cuadernos?",
        ]}
      />

      <ChatPanel
        scope="inventory"
        title="Agregar al inventario"
        description="Describe los productos y revisa la propuesta antes de cargarla."
        placeholder="Agrega 20 cuadernos a Q18 cada uno..."
        empty="Escribe una lista o describe lo que tienes. Los paquetes y los individuales se guardan por separado."
        examples={[
          "Agrega 20 cuadernos a Q18",
          "Hoja carta a Q0.25 y el ciento a Q20",
          "Lápiz a Q2.50, 48 sueltos y 15 paquetes de 12 a Q24",
        ]}
      />
    </div>
  );
}
