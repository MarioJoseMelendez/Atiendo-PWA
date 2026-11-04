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
          <p className="mt-2 text-sm text-muted-foreground">
            Piezas y paquetes, con su QR y su precio.
          </p>
        </div>
        <Button variant="outline" className="h-10" onClick={() => setGroupDialog("create")}>
          Nuevo grupo
        </Button>
      </header>

      <p className="text-sm text-muted-foreground">
        {store.products.length} {store.products.length === 1 ? "artículo" : "artículos"} ·{" "}
        {loose} sueltos · {packs} paquetes ·{" "}
        {formatQ(inventoryValueCents(store.products))} en inventario
        {soldToday == null ? "" : ` · ${formatQ(soldToday)} cobrado hoy`}
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
            {store.groups.map((item) => {
              const count = store.products.filter((product) => product.groupId === item.id).length;
              const selected = item.id === group?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPickedGroupId(item.id)}
                  className={cn(
                    "min-w-40 rounded-xl border px-3 py-2.5 text-left md:min-w-0",
                    selected
                      ? "border-[#1e3d32] bg-[#1e3d32] text-[#f6f1e6]"
                      : "border-border bg-card",
                  )}
                >
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span
                    className={cn(
                      "block text-xs",
                      selected ? "text-[#f6f1e6]/75" : "text-muted-foreground",
                    )}
                  >
                    {count} {count === 1 ? "artículo" : "artículos"}
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
                  <p className="text-xs text-muted-foreground">Prefijo {group.prefix}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar grupo ${group.name}`}
                    title="Editar grupo"
                    onClick={() => setGroupDialog(group.id)}
                  >
                    <Pencil />
                  </Button>
                  <Link
                    href={`/etiquetas#${group.id}`}
                    className={buttonVariants({ variant: "outline", className: "h-10" })}
                  >
                    <QrCode />
                    QRs
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
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${product.name}`}
                          title="Editar"
                          onClick={() => setProductDialog(product.id)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Borrar ${product.name}`}
                          title="Borrar"
                          onClick={() => setPendingDelete(product)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={store.products.some((product) => product.groupId === group.id)}
                  aria-label="Borrar grupo"
                  title={
                    store.products.some((product) => product.groupId === group.id)
                      ? "Quita los artículos primero"
                      : "Borrar grupo"
                  }
                  onClick={() => {
                    const message = inventory.removeGroup(group.id);
                    setNotice(message);
                  }}
                >
                  <Trash2 />
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
