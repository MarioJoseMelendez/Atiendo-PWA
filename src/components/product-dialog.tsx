"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseInteger, parseQuetzales, quetzalesInput } from "@/lib/money";
import type { Group, Product, ProductInput, SaleKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductDialog({
  open,
  product,
  groups,
  defaultGroupId,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  product: Product | null;
  groups: Group[];
  defaultGroupId: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ProductInput, id?: string) => string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ProductForm
          key={product?.id ?? `nuevo-${defaultGroupId ?? "grupo"}`}
          product={product}
          groups={groups}
          defaultGroupId={defaultGroupId}
          onOpenChange={onOpenChange}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}

function ProductForm({
  product,
  groups,
  defaultGroupId,
  onOpenChange,
  onSave,
}: {
  product: Product | null;
  groups: Group[];
  defaultGroupId: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: ProductInput, id?: string) => string | null;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [groupId, setGroupId] = useState(product?.groupId ?? defaultGroupId ?? groups[0]?.id ?? "");
  const [kind, setKind] = useState<SaleKind>(product?.kind ?? "individual");
  const [packageSize, setPackageSize] = useState(product?.packageSize ? String(product.packageSize) : "12");
  const [price, setPrice] = useState(product ? quetzalesInput(product.priceCents) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader className="pr-8">
        <DialogTitle className="font-heading text-lg">
          {product ? "Editar artículo" : "Nuevo artículo"}
        </DialogTitle>
        <DialogDescription>
          Individual se cobra por pieza. Paquete se cobra entero, con su tamaño y su propio precio.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const priceCents = parseQuetzales(price);
          const stockCount = parseInteger(stock);
          const size = parseInteger(packageSize);
          if (priceCents == null) {
            setError("Escribe el precio en quetzales, por ejemplo 24.50.");
            return;
          }
          if (stockCount == null) {
            setError("La existencia tiene que ser un número entero.");
            return;
          }
          const message = onSave(
            {
              name,
              groupId,
              kind,
              packageSize: kind === "paquete" ? size : null,
              priceCents,
              stock: stockCount,
            },
            product?.id,
          );
          if (message) {
            setError(message);
            return;
          }
          onOpenChange(false);
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="product-name">Nombre</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Lápiz Mongol"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="product-group">Grupo</Label>
          <select
            id="product-group"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Cómo se vende</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cómo se vende">
            <KindOption
              selected={kind === "individual"}
              title="Individual"
              detail="Una pieza, un precio."
              onSelect={() => setKind("individual")}
            />
            <KindOption
              selected={kind === "paquete"}
              title="Paquete"
              detail="Varias piezas a un solo precio."
              onSelect={() => setKind("paquete")}
            />
          </div>
        </fieldset>
        {kind === "paquete" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="package-size">Piezas por paquete</Label>
            <Input
              id="package-size"
              inputMode="numeric"
              value={packageSize}
              onChange={(event) => setPackageSize(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              El precio de abajo es el del paquete completo, no el de cada pieza. La existencia
              cuenta paquetes.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            El precio es por una pieza. La existencia cuenta piezas sueltas.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="product-price">
              {kind === "paquete" ? "Precio por paquete" : "Precio por pieza"}
            </Label>
            <Input
              id="product-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="product-stock">
              {kind === "paquete" ? "Paquetes en existencia" : "Piezas en existencia"}
            </Label>
            <Input
              id="product-stock"
              inputMode="numeric"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </div>
        </div>
        {product ? (
          <p className="text-xs text-muted-foreground">
            El QR sigue siendo {product.code}. Si ya lo imprimiste, no hace falta sacarlo de nuevo.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="h-10">
            Guardar artículo
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function KindOption({
  selected,
  title,
  detail,
  onSelect,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-xl border px-3 py-3 text-left",
        selected ? "border-[#1e3d32] bg-[#1e3d32] text-[#f6f1e6]" : "border-border bg-card text-foreground",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className={cn("mt-1 block text-xs", selected ? "text-[#f6f1e6]/80" : "text-muted-foreground")}>
        {detail}
      </span>
    </button>
  );
}
