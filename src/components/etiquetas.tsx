"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { labelSections, unitPhrase } from "@/lib/inventory";
import type { LabelFormat } from "@/lib/labels";
import { replaceLabelGroup, useLabelGroup } from "@/lib/live";
import { formatQ } from "@/lib/money";
import { encodeQr } from "@/lib/qr";
import { pushStore } from "@/lib/remote";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Etiquetas() {
  const { ready, store } = useInventory();
  const groupId = useLabelGroup();
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [scope, setScope] = useState("all");
  const [scopeTouched, setScopeTouched] = useState(false);
  const [downloading, setDownloading] = useState<LabelFormat | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const productOptions = useMemo(
    () =>
      store.groups
        .map((group) => ({
          group,
          products: store.products
            .filter((product) => product.groupId === group.id)
            .sort((a, b) => a.name.localeCompare(b.name, "es")),
        }))
        .filter((entry) => entry.products.length > 0),
    [store.groups, store.products],
  );

  const effectiveScope = useMemo(() => {
    if (
      !scopeTouched &&
      groupId !== "todo" &&
      store.groups.some((group) => group.id === groupId)
    ) {
      return `group:${groupId}`;
    }
    if (scope.startsWith("group:")) {
      const id = scope.slice(6);
      return store.groups.some((group) => group.id === id) ? scope : "all";
    }
    if (scope.startsWith("product:")) {
      const id = scope.slice(8);
      return store.products.some((product) => product.id === id) ? scope : "all";
    }
    return scope;
  }, [groupId, scope, scopeTouched, store.groups, store.products]);

  const downloadCount = useMemo(() => {
    if (effectiveScope === "all") return store.products.length;
    const [kind, id] = effectiveScope.split(":");
    if (kind === "group") {
      return store.products.filter((product) => product.groupId === id).length;
    }
    if (kind === "product") {
      return store.products.some((product) => product.id === id) ? 1 : 0;
    }
    return 0;
  }, [effectiveScope, store.products]);

  async function download(format: LabelFormat) {
    if (downloading || downloadCount === 0) return;
    setDownloading(format);
    setDownloadError(null);
    await pushStore(store);
    const [kind, id] = effectiveScope.split(":");
    const params = new URLSearchParams({ scope: kind || "all", format });
    if (id) params.set("id", id);
    try {
      const response = await fetch(`/api/etiquetas?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setDownloadError(payload?.error ?? "No se pudo generar la descarga.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `atiendo-etiquetas.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setDownloadError("No se pudo conectar con el servidor.");
    } finally {
      setDownloading(null);
    }
  }

  const sections = useMemo(() => {
    if (!ready) return [];
    return labelSections(store, groupId);
  }, [ready, store, groupId]);

  const products = useMemo(
    () => sections.flatMap((section) => section.products),
    [sections],
  );

  useEffect(() => {
    if (!ready || products.length === 0) return;
    let cancelled = false;
    const current = products;
    void import("qrcode").then(async (module) => {
      const entries = await Promise.all(
        current.map(async (product) => {
          const svg = await module.default.toString(encodeQr(product.code), {
            type: "svg",
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#1c1915", light: "#fffaf3" },
          });
          return [product.id, svg.replace(/<\?xml[^>]*>/i, "").trim()] as const;
        }),
      );
      if (!cancelled) setSvgs(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, products]);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Preparando las etiquetas…</p>;
  }

  const selected = store.groups.find((group) => group.id === groupId);
  const title =
    groupId === "todo" ? "Todo el inventario" : (selected?.name ?? "Grupo no encontrado");

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:block">
        <div>
          <h1 className="font-heading text-3xl tracking-tight print:text-2xl">Etiquetas</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground print:hidden">
            Descarga o imprime. Cada paquete y cada individual es una etiqueta aparte.
          </p>
          <p className="sheet-heading mt-3 hidden font-heading text-lg print:block">
            Atiendo · {title}
          </p>
        </div>
        <Button className="h-10 print:hidden" onClick={() => window.print()} disabled={products.length === 0}>
          <Printer />
          Imprimir etiquetas
        </Button>
      </header>

      <section className="grid gap-3 rounded-xl border border-border bg-card/70 p-3 print:hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Descargar etiquetas
          </span>
          <select
            value={effectiveScope}
            onChange={(event) => {
              setScope(event.target.value);
              setScopeTouched(true);
              setDownloadError(null);
            }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Qué etiquetas quieres descargar"
          >
            <option value="all">Todo el inventario ({store.products.length})</option>
            {productOptions.length > 0 ? (
              <optgroup label="Por tipo">
                {productOptions.map((entry) => (
                  <option key={entry.group.id} value={`group:${entry.group.id}`}>
                    {entry.group.name} ({entry.products.length})
                  </option>
                ))}
              </optgroup>
            ) : null}
            {productOptions.length > 0 ? (
              <optgroup label="Por producto">
                {productOptions.flatMap((entry) =>
                  entry.products.map((product) => (
                    <option key={product.id} value={`product:${product.id}`}>
                      {entry.group.name} · {product.name} · {unitPhrase(product)} ({product.code})
                    </option>
                  )),
                )}
              </optgroup>
            ) : null}
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => void download("pdf")}
            disabled={downloading !== null || downloadCount === 0}
          >
            {downloading === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void download("docx")}
            disabled={downloading !== null || downloadCount === 0}
          >
            {downloading === "docx" ? <Loader2 className="animate-spin" /> : <FileText />}
            Word
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
          Los paquetes y los individuales van como etiquetas separadas. El archivo sale listo para
          imprimir.
        </p>
        {downloadError ? (
          <p className="text-xs text-destructive sm:col-span-2" role="alert">
            {downloadError}
          </p>
        ) : null}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        <GroupChip
          selected={groupId === "todo"}
          onClick={() => {
            replaceLabelGroup("todo");
            setScope("all");
          }}
        >
          Todo el inventario
        </GroupChip>
        {store.groups.map((group) => (
          <GroupChip
            key={group.id}
            selected={groupId === group.id}
            onClick={() => {
              replaceLabelGroup(group.id);
              setScope(`group:${group.id}`);
            }}
          >
            {group.name}
          </GroupChip>
        ))}
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        {products.length === 1 ? "1 etiqueta" : `${products.length} etiquetas`}
        {selected ? ` en ${selected.name}` : groupId === "todo" ? " de todo el inventario" : ""}
      </p>

      {groupId !== "todo" && !selected ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          Ese grupo ya no está en el inventario.
        </p>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <p className="font-heading text-xl">No hay artículos para etiquetar</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Agrega piezas o paquetes en el inventario y vuelve a sacar los QR.
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          {sections.map((section) => (
            <section key={section.group.id}>
              <h2 className="sheet-heading mb-3 font-heading text-xl">{section.group.name}</h2>
              {section.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este grupo no tiene artículos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
                  {section.products.map((product) => (
                    <QrLabel key={product.id} product={product} svg={svgs[product.id]} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm",
        selected ? "border-[#1e3d32] bg-[#1e3d32] text-[#f6f1e6]" : "border-border bg-card",
      )}
    >
      {children}
    </button>
  );
}

function QrLabel({ product, svg }: { product: Product; svg?: string }) {
  const safe = svg && svg.startsWith("<svg") && !svg.includes("<script") ? svg : "";
  return (
    <article className="label-card flex flex-col items-center rounded-xl border border-dashed border-[#cbb892] bg-[#fffaf3] px-3 py-4">
      <div
        className="qr-svg w-full max-w-40"
        role="img"
        aria-label={`QR de ${product.name}, ${unitPhrase(product)}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      <p className="mt-2 line-clamp-2 text-center font-heading text-[13px] leading-4 text-balance">
        {product.name}
      </p>
      <p className="mt-1 text-center text-[11px] leading-4 text-[#645c52]">
        {unitPhrase(product)} · {formatQ(product.priceCents)}
      </p>
      <p className="mt-1 font-mono text-[10px] tracking-wide text-[#645c52]">{product.code}</p>
    </article>
  );
}
