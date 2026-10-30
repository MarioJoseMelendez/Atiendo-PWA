"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { GroupDialog } from "@/components/group-dialog";
import { useInventory } from "@/components/inventory-provider";
import { ProductDialog } from "@/components/product-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  inventoryValueCents,
  isLowStock,
  priceSuffix,
  stockPhrase,
  unitPhrase,
} from "@/lib/inventory";
import { formatQ } from "@/lib/money";
import { guatemalaDayKey } from "@/lib/dates";
import { useGuatemalaToday } from "@/lib/live";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPINES = ["#9c3b2e", "#1e3d32", "#8a5a2b", "#24506e", "#6b3f55"];

export function Inventario() {
  const inventory = useInventory();
  const { ready, store } = inventory;
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groupDialog, setGroupDialog] = useState<"create" | string | null>(null);
  const [productDialog, setProductDialog] = useState<"create" | string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dayKey = useGuatemalaToday(guatemalaDayKey);
  const groupId =
    pickedGroupId && store.groups.some((item) => item.id === pickedGroupId)
      ? pickedGroupId
      : (store.groups[0]?.id ?? null);

  const group = store.groups.find((item) => item.id === groupId) ?? null;
  const products = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return store.products
      .filter((product) => product.groupId === group?.id)
      .filter((product) => {
        if (!needle) return true;
        return (
          product.name.toLocaleLowerCase("es").includes(needle) ||
          product.code.toLocaleLowerCase("es").includes(needle)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [store.products, group?.id, query]);

  const loose = store.products.filter((product) => product.kind === "individual").length;
  const packs = store.products.filter((product) => product.kind === "paquete").length;
  const soldToday = dayKey
    ? store.sales.filter((sale) => sale.dayKey === dayKey).reduce((sum, sale) => sum + sale.totalCents, 0)
    : null;

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Abriendo Atiendo…</p>;
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Inventario</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Los sueltos se cobran por pieza. Los paquetes se cobran enteros, con el tamaño y un
            precio distinto.
          </p>
        </div>
        <Button className="h-10" onClick={() => setGroupDialog("create")}>
          Nuevo grupo
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Artículos" value={String(store.products.length)} />
        <Stat label="Sueltos" value={String(loose)} />
        <Stat label="Paquetes" value={String(packs)} />
        <Stat
          label="Cobrado hoy"
          value={soldToday == null ? "—" : formatQ(soldToday)}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Valor en inventario: {formatQ(inventoryValueCents(store.products))}
      </p>

      {notice ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {notice}
        </p>
      ) : null}

      {store.groups.length === 0 ? (
        <Card>
          <CardContent className="grid gap-3 py-8 text-center">
            <p className="font-heading text-xl">Todavía no hay grupos</p>
            <p className="text-sm text-muted-foreground">
              Crea uno para ordenar el inventario, por ejemplo Novela o Papelería.
            </p>
            <div>
              <Button onClick={() => setGroupDialog("create")}>Crear el primer grupo</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start">
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {store.groups.map((item, index) => {
              const count = store.products.filter((product) => product.groupId === item.id).length;
              const selected = item.id === group?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPickedGroupId(item.id)}
                  className={cn(
                    "flex min-w-40 items-center gap-3 rounded-xl border px-3 py-3 text-left md:min-w-0",
                    selected
                      ? "border-[#1e3d32] bg-[#1e3d32] text-[#f6f1e6]"
                      : "border-border bg-card",
                  )}
                >
                  <span
                    className="h-8 w-1.5 rounded-full"
                    style={{ background: SPINES[index % SPINES.length] }}
                  />
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className={cn("block text-xs", selected ? "text-[#f6f1e6]/75" : "text-muted-foreground")}>
                      {count} {count === 1 ? "artículo" : "artículos"} · {item.prefix}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {group ? (
            <section className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl">{group.name}</h2>
                  <p className="text-sm text-muted-foreground">Prefijo de códigos {group.prefix}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setGroupDialog(group.id)}>
                    Editar grupo
                  </Button>
                  <Link
                    href={`/etiquetas#${group.id}`}
                    className={buttonVariants({ variant: "outline", className: "h-10" })}
                  >
                    <QrCode />
                    Sacar QRs
                  </Link>
                  <Button className="h-10" onClick={() => setProductDialog("create")}>
                    Nuevo artículo
                  </Button>
                </div>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o código"
                aria-label="Buscar en este grupo"
              />
              {products.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="font-heading text-xl">
                      {query ? "Nada coincide con esa búsqueda" : "Este grupo está vacío"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {query
                        ? "Prueba con el código del QR, por ejemplo PP-002."
                        : "Agrega el primer artículo para poder imprimir su etiqueta."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ul className="grid gap-3">
                  {products.map((product) => (
                    <li
                      key={product.id}
                      className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading text-lg leading-tight">{product.name}</h3>
                          <Badge variant={product.kind === "paquete" ? "secondary" : "outline"}>
                            {unitPhrase(product)}
                          </Badge>
                          {product.stock === 0 ? (
                            <Badge variant="destructive">Agotado</Badge>
                          ) : isLowStock(product) ? (
                            <Badge variant="outline">Queda poco</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground">
                          {product.code}
                        </p>
                        <p className="mt-3 text-xl font-medium">
                          {formatQ(product.priceCents)}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            {priceSuffix(product)}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{stockPhrase(product)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <div className="inline-flex items-center rounded-lg border border-border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Quitar una existencia de ${product.name}`}
                            onClick={() => {
                              const message = inventory.changeStock(product.id, -1);
                              setNotice(message);
                            }}
                          >
                            <Minus />
                          </Button>
                          <span className="min-w-8 text-center text-sm">{product.stock}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Sumar una existencia de ${product.name}`}
                            onClick={() => {
                              const message = inventory.changeStock(product.id, 1);
                              setNotice(message);
                            }}
                          >
                            <Plus />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setProductDialog(product.id)}
                        >
                          <Pencil />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setPendingDelete(product)}
                        >
                          <Trash2 />
                          Borrar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  {store.products.some((product) => product.groupId === group.id)
                    ? "Para borrar el grupo, primero quita sus artículos."
                    : "Este grupo ya no tiene artículos."}
                </p>
                <Button
                  variant="ghost"
                  disabled={store.products.some((product) => product.groupId === group.id)}
                  onClick={() => {
                    const message = inventory.removeGroup(group.id);
                    setNotice(message);
                  }}
                >
                  Borrar grupo
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      )}

      <GroupDialog
        open={groupDialog !== null}
        group={
          groupDialog && groupDialog !== "create"
            ? (store.groups.find((item) => item.id === groupDialog) ?? null)
            : null
        }
        takenPrefixes={store.groups
          .filter((item) => item.id !== groupDialog)
          .map((item) => item.prefix)}
        onOpenChange={(open) => {
          if (!open) setGroupDialog(null);
        }}
        onSave={(input, id) => inventory.saveGroupDraft(input, id)}
      />
      <ProductDialog
        open={productDialog !== null}
        product={
          productDialog && productDialog !== "create"
            ? (store.products.find((item) => item.id === productDialog) ?? null)
            : null
        }
        groups={store.groups}
        defaultGroupId={group?.id ?? null}
        onOpenChange={(open) => {
          if (!open) setProductDialog(null);
        }}
        onSave={(input, id) => inventory.saveProductDraft(input, id)}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita del inventario. El QR {pendingDelete?.code} dejará de cobrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                const message = inventory.removeProduct(pendingDelete.id);
                setNotice(message);
                setPendingDelete(null);
              }}
            >
              Borrar artículo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl leading-none">{value}</p>
      </CardContent>
    </Card>
  );
}
