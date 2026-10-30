"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useInventory } from "@/components/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DraftProduct, InventoryDraft } from "@/lib/import";
import { unitPhrase } from "@/lib/inventory";
import { formatQ } from "@/lib/money";

const KEY_STORAGE = "atiendo.nvidia.key";
const LEGACY_KEY_STORAGE = "estante.nvidia.key";

function subscribeKey(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readSavedKey(): string {
  try {
    return (
      localStorage.getItem(KEY_STORAGE) ?? localStorage.getItem(LEGACY_KEY_STORAGE) ?? ""
    );
  } catch {
    return "";
  }
}

const EXAMPLE = `Hoja blanca carta: la hoja a Q0.25 y el ciento a Q20. Tengo 300 hojas sueltas y 5 cientos.
Lápiz Mongol: Q2.50 cada uno, hay 48; el paquete de 12 cuesta Q24 y tengo 15 paquetes.
Cuaderno cosido 100 hojas: Q18 cada uno, 30; el paquete de 5 a Q80, 10 paquetes.`;

type DraftResponse =
  | { ok: true; draft: InventoryDraft }
  | { ok: false; error: string; raw?: string };

function isDraftResponse(value: unknown): value is DraftResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.ok === true) {
    const draft = record.draft;
    if (!draft || typeof draft !== "object") return false;
    const candidate = draft as InventoryDraft;
    return typeof candidate.summary === "string" && Array.isArray(candidate.products);
  }
  return record.ok === false && typeof record.error === "string";
}

export function Cargar() {
  const { ready, store, importDraft } = useInventory();
  const [text, setText] = useState("");
  const savedKey = useSyncExternalStore(subscribeKey, readSavedKey, () => "");
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const apiKey = keyDraft ?? savedKey;
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<InventoryDraft | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function updateKey(value: string) {
    setKeyDraft(value);
    try {
      localStorage.setItem(KEY_STORAGE, value);
    } catch {
      // Sin almacenamiento, la clave solo vive en esta pantalla.
    }
  }

  const sections = useMemo(() => {
    if (!draft) return [];
    const map = new Map<string, DraftProduct[]>();
    for (const product of draft.products) {
      const list = map.get(product.group) ?? [];
      list.push(product);
      map.set(product.group, list);
    }
    return [...map.entries()];
  }, [draft]);

  async function interpret() {
    if (!text.trim()) {
      setError("Pega o escribe la lista de productos primero.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setDraft(null);
    try {
      const response = await fetch("/api/inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          apiKey: apiKey.trim() || undefined,
          existing: {
            groups: store.groups.map((group) => group.name),
            products: store.products.map((product) => ({
              name: product.name,
              kind: product.kind,
              packageSize: product.packageSize,
            })),
          },
        }),
      });
      const payload: unknown = await response.json();
      if (!isDraftResponse(payload)) {
        setError("El servidor devolvió una respuesta inesperada.");
        return;
      }
      if (!payload.ok) {
        setError(payload.error);
        return;
      }
      setDraft(payload.draft);
    } catch {
      setError("No se pudo conectar con el servidor. Revisa que la app siga corriendo.");
    } finally {
      setBusy(false);
    }
  }

  function load() {
    if (!draft) return;
    const outcome = importDraft(draft);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    const parts = [
      outcome.imported === 0
        ? "No había artículos nuevos."
        : `Se cargaron ${outcome.imported} ${
            outcome.imported === 1 ? "artículo" : "artículos"
          }.`,
    ];
    if (outcome.skipped > 0) {
      parts.push(
        `Se omitieron ${outcome.skipped} ${
          outcome.skipped === 1 ? "repetido" : "repetidos"
        } que ya estaban en el inventario.`,
      );
    }
    setResult(parts.join(" "));
    setDraft(null);
    setText("");
  }

  return (
    <div className="grid gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-3xl tracking-tight">Carga rápida</h1>
          <Badge variant="secondary">
            <Sparkles />
            NVIDIA
          </Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pega una lista, una factura o describe lo que tienes. La IA lo convierte en artículos y
          tú revisas antes de cargarlos. El mismo producto puede quedar por pieza y por ciento con
          precios distintos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">1. Tu lista</CardTitle>
          <CardDescription>
            Escribe producto, precio y existencia. Si el mismo producto se vende suelto y por
            ciento, menciónalo en la misma línea.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={EXAMPLE}
            aria-label="Lista de productos"
            className="min-h-44 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setText(EXAMPLE);
                setError(null);
                setDraft(null);
              }}
            >
              Usar un ejemplo
            </Button>
            {text ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setText("");
                  setDraft(null);
                  setError(null);
                }}
              >
                <Trash2 />
                Limpiar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <KeyRound className="size-4" />
            2. Clave de NVIDIA
          </CardTitle>
          <CardDescription>
            Se guarda solo en este navegador. Consíguela en{" "}
            <a
              href="https://build.nvidia.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              build.nvidia.com
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Label htmlFor="nvidia-key">API key</Label>
          <div className="flex gap-2">
            <Input
              id="nvidia-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => updateKey(event.target.value)}
              placeholder="nvapi-..."
              autoComplete="off"
              spellCheck={false}
              className="h-10 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {result ? (
        <p className="flex items-start gap-2 rounded-lg bg-[#1e3d32]/10 px-3 py-2 text-sm text-[#1e3d32]" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {result}
        </p>
      ) : null}

      <div>
        <Button
          type="button"
          className="h-11"
          onClick={() => void interpret()}
          disabled={busy || !ready || text.trim().length === 0}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {busy ? "Leyendo la lista…" : "Interpretar con NVIDIA"}
        </Button>
      </div>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Revisa antes de cargar</CardTitle>
            <CardDescription>{draft.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {sections.map(([groupName, products]) => (
              <section key={groupName} className="grid gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-heading text-base">{groupName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {products.length} {products.length === 1 ? "artículo" : "artículos"}
                  </p>
                </div>
                <ul className="grid gap-2">
                  {products.map((product, index) => (
                    <li
                      key={`${groupName}-${product.name}-${product.kind}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {unitPhrase(product)} · {formatQ(product.priceCents)} ·{" "}
                          {product.stock} en existencia
                        </p>
                      </div>
                      <Badge variant={product.kind === "paquete" ? "secondary" : "outline"}>
                        {product.kind === "paquete" ? "Paquete" : "Individual"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Se agregan al inventario actual; no se borra nada.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Descartar
              </Button>
              <Button type="button" className="h-10" onClick={load}>
                Cargar {draft.products.length}{" "}
                {draft.products.length === 1 ? "artículo" : "artículos"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
