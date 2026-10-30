"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useInventory } from "@/components/inventory-provider";
import { Button } from "@/components/ui/button";
import { labelSections, unitPhrase } from "@/lib/inventory";
import { replaceLabelGroup, useLabelGroup } from "@/lib/live";
import { formatQ } from "@/lib/money";
import { encodeQr } from "@/lib/qr";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Etiquetas() {
  const { ready, store } = useInventory();
  const groupId = useLabelGroup();
  const [svgs, setSvgs] = useState<Record<string, string>>({});

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
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground print:hidden">
            Cada QR lleva debajo el nombre de lo que es. Elige un grupo o saca todo el inventario.
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

      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        <GroupChip selected={groupId === "todo"} onClick={() => replaceLabelGroup("todo")}>
          Todo el inventario
        </GroupChip>
        {store.groups.map((group) => (
          <GroupChip key={group.id} selected={groupId === group.id} onClick={() => replaceLabelGroup(group.id)}>
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
