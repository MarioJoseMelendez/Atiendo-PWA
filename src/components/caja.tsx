"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useInventory } from "@/components/inventory-provider";
import { Scanner } from "@/components/scanner";
import { Badge } from "@/components/ui/badge";
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
import { guatemalaDayKey } from "@/lib/dates";
import { quoteCart, unitPhrase } from "@/lib/inventory";
import { useGuatemalaToday } from "@/lib/live";
import { cashSuggestions, formatQ, parseQuetzales, quetzalesInput } from "@/lib/money";
import { decodeQr } from "@/lib/qr";
import type { CartLine, Product, Sale } from "@/lib/types";

export function Caja() {
  const { ready, store, chargeCash } = useInventory();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [cashOpen, setCashOpen] = useState(false);
  const [tendered, setTendered] = useState("");
  const [cashError, setCashError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const dayKey = useGuatemalaToday(guatemalaDayKey);
  const lastScan = useRef({ code: "", at: 0 });
  const amountRef = useRef<HTMLInputElement>(null);

  const quote = useMemo(
    () =>
      quoteCart(
        store,
        cart.filter((line) => store.products.some((product) => product.id === line.productId)),
      ),
    [store, cart],
  );
  const suggestions = cashSuggestions(quote.totalCents);
  const typedCents = parseQuetzales(tendered);
  const changeCents = typedCents == null ? null : typedCents - quote.totalCents;

  useEffect(() => {
    if (!cashOpen) return;
    const frame = requestAnimationFrame(() => amountRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [cashOpen]);

  function addProduct(product: Product) {
    setCart((lines) => {
      const current = lines.find((line) => line.productId === product.id)?.qty ?? 0;
      if (product.stock <= 0 || current >= product.stock) return lines;
      const next = lines.some((line) => line.productId === product.id)
        ? lines.map((line) =>
            line.productId === product.id ? { ...line, qty: line.qty + 1 } : line,
          )
        : [...lines, { productId: product.id, qty: 1 }];
      return next;
    });
    const current = cart.find((line) => line.productId === product.id)?.qty ?? 0;
    if (product.stock <= 0) {
      setNotice({ tone: "bad", text: `${product.name} está agotado.` });
      return;
    }
    if (current >= product.stock) {
      setNotice({ tone: "bad", text: `${product.name}: solo quedan ${product.stock}.` });
      return;
    }
    setReceipt(null);
    setNotice({
      tone: "ok",
      text: `Agregado: ${product.name} · ${unitPhrase(product)} · ${formatQ(product.priceCents)}`,
    });
    beep();
  }

  function addByRaw(raw: string) {
    const decoded = decodeQr(raw);
    if (!decoded) {
      setNotice({ tone: "bad", text: "Ese código no es de la librería. Usa el que va debajo del QR." });
      return;
    }
    const product = store.products.find((item) => item.code === decoded);
    if (!product) {
      setNotice({ tone: "bad", text: `No hay un artículo con el código ${decoded}.` });
      return;
    }
    addProduct(product);
  }

  function onScan(raw: string) {
    const decoded = decodeQr(raw);
    if (!decoded) {
      setNotice({ tone: "bad", text: "Ese QR no es de la librería." });
      return;
    }
    const now = Date.now();
    if (lastScan.current.code === decoded && now - lastScan.current.at < 1200) return;
    lastScan.current = { code: decoded, at: now };
    addByRaw(decoded);
  }

  function setQty(productId: string, qty: number) {
    setCart((lines) => {
      if (qty <= 0) return lines.filter((line) => line.productId !== productId);
      const product = store.products.find((item) => item.id === productId);
      const nextQty = product ? Math.min(qty, product.stock) : qty;
      return lines.map((line) => (line.productId === productId ? { ...line, qty: nextQty } : line));
    });
  }

  const needle = search.trim().toLocaleLowerCase("es");
  const matches =
    needle.length < 2
      ? []
      : store.products
          .filter(
            (product) =>
              product.name.toLocaleLowerCase("es").includes(needle) ||
              product.code.toLocaleLowerCase("es").includes(needle),
          )
          .slice(0, 6);

  const today = dayKey ? store.sales.filter((sale) => sale.dayKey === dayKey) : [];
  const todayTotal = today.reduce((sum, sale) => sum + sale.totalCents, 0);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Abriendo la caja…</p>;
  }

  return (
    <div className={quote.rows.length > 0 ? "grid gap-6 pb-28 lg:pb-0" : "grid gap-6"}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-3xl tracking-tight">Caja</h1>
          <Badge variant="secondary">Solo efectivo</Badge>
        </div>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Escanea el QR con la cámara. El precio que se cobra es el de la pieza o el del paquete,
          según la etiqueta.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid gap-4">
          <Scanner onScan={onScan} />
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              addByRaw(code);
              setCode("");
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="manual-code">Código de la etiqueta</Label>
              <Input
                id="manual-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="PP-002"
                autoComplete="off"
                className="h-11 uppercase"
              />
            </div>
            <Button type="submit" className="h-11 sm:self-end">
              Agregar
            </Button>
          </form>
          <div className="grid gap-1.5">
            <Label htmlFor="name-search">O busca por nombre</Label>
            <Input
              id="name-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lápiz, cuaderno, principito…"
            />
            {matches.length > 0 ? (
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {matches.map((product) => (
                  <li key={product.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        addProduct(product);
                        setSearch("");
                      }}
                    >
                      <span>
                        <span className="block text-sm font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {product.code} · {unitPhrase(product)}
                        </span>
                      </span>
                      <span className="text-sm">{formatQ(product.priceCents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {notice ? (
            <p
              role="status"
              className={
                notice.tone === "ok"
                  ? "rounded-lg bg-[#1e3d32]/10 px-3 py-2 text-sm text-[#1e3d32]"
                  : "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {notice.text}
            </p>
          ) : null}
        </section>

        <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 lg:sticky lg:top-6">
          <h2 className="font-heading text-xl">Ticket</h2>
          {receipt ? (
            <div className="rounded-xl bg-[#f3ead7] px-3 py-3">
              <p className="text-sm text-[#645c52]">Venta registrada · {receipt.whenLabel}</p>
              <p className="mt-1 font-heading text-3xl">
                {receipt.changeCents === 0 ? "Pago exacto" : `Cambio ${formatQ(receipt.changeCents)}`}
              </p>
              <p className="mt-1 text-sm">Total {formatQ(receipt.totalCents)}</p>
            </div>
          ) : null}
          {quote.rows.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Todavía no hay artículos. Escanea un QR o escribe su código.
            </p>
          ) : (
            <ul className="grid gap-3">
              {quote.rows.map((row) => (
                <li key={row.product.id} className="grid gap-2 border-b border-border pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium leading-tight">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {unitPhrase(row.product)} · {formatQ(row.product.priceCents)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatQ(row.lineCents)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Quitar uno de ${row.product.name}`}
                      onClick={() => setQty(row.product.id, row.qty - 1)}
                    >
                      <Minus />
                    </Button>
                    <span className="min-w-6 text-center text-sm">{row.qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Agregar otro ${row.product.name}`}
                      disabled={row.qty >= row.product.stock}
                      onClick={() => setQty(row.product.id, row.qty + 1)}
                    >
                      <Plus />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQty(row.product.id, 0)}
                    >
                      <Trash2 />
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end justify-between">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="font-heading text-3xl">{formatQ(quote.totalCents)}</p>
          </div>
          {quote.rows.length > 0 && quote.issues.length > 0 ? (
            <p className="text-sm text-destructive" role="alert">
              {quote.issues[0]}
            </p>
          ) : null}
          <Button
            type="button"
            className="hidden h-12 text-base md:inline-flex"
            disabled={quote.rows.length === 0 || quote.issues.length > 0}
            onClick={() => {
              setTendered(quetzalesInput(quote.totalCents));
              setCashError(null);
              setCashOpen(true);
            }}
          >
            Cobrar en efectivo
          </Button>
        </section>
      </div>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xl">Ventas de hoy</h2>
          <p className="text-sm text-muted-foreground">
            {dayKey ? `${today.length} · ${formatQ(todayTotal)}` : "—"}
          </p>
        </div>
        {dayKey && today.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ventas guardadas hoy.</p>
        ) : (
          <ul className="grid gap-2">
            {today.map((sale) => (
              <li
                key={sale.id}
                className="grid gap-1 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center"
              >
                <span>
                  <span className="block font-medium">{formatQ(sale.totalCents)}</span>
                  <span className="text-xs text-muted-foreground">
                    {sale.whenLabel} · cambio {formatQ(sale.changeCents)}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground sm:text-right">
                  {sale.lines.map((line) => `${line.qty} ${line.name}`).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {quote.rows.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#e3d5bb] bg-[#fffaf3] p-3 md:hidden">
          <Button
            type="button"
            className="h-12 w-full text-base"
            disabled={quote.issues.length > 0}
            onClick={() => {
              setTendered(quetzalesInput(quote.totalCents));
              setCashError(null);
              setCashOpen(true);
            }}
          >
            Cobrar en efectivo · {formatQ(quote.totalCents)}
          </Button>
        </div>
      ) : null}

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-heading text-lg">Cobro en efectivo</DialogTitle>
            <DialogDescription>
              Esta caja no acepta tarjeta ni transferencia. Cuenta el billete y registra el cambio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <p className="font-heading text-4xl">{formatQ(quote.totalCents)}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={typedCents === amount ? "default" : "outline"}
                  onClick={() => setTendered(quetzalesInput(amount))}
                >
                  {amount === quote.totalCents ? "Exacto" : formatQ(amount)}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tendered">Efectivo recibido</Label>
              <Input
                ref={amountRef}
                id="tendered"
                inputMode="decimal"
                value={tendered}
                onChange={(event) => setTendered(event.target.value)}
                className="h-14 text-center font-heading text-3xl"
              />
            </div>
            <p
              className={
                changeCents != null && changeCents < 0
                  ? "font-heading text-2xl text-destructive"
                  : "font-heading text-2xl text-[#1e3d32]"
              }
              role="status"
            >
              {changeCents == null
                ? "Escribe cuánto te entregaron."
                : changeCents < 0
                  ? `Faltan ${formatQ(Math.abs(changeCents))}`
                  : changeCents === 0
                    ? "Pago exacto"
                    : `Cambio ${formatQ(changeCents)}`}
            </p>
            {cashError ? (
              <p className="text-sm text-destructive" role="alert">
                {cashError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCashOpen(false)}>
              Volver
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={typedCents == null || typedCents < quote.totalCents}
              onClick={() => {
                if (typedCents == null) {
                  setCashError("Escribe el efectivo recibido, por ejemplo 100 o 100.50.");
                  return;
                }
                const result = chargeCash(cart, typedCents);
                if (!result.ok) {
                  setCashError(result.error);
                  return;
                }
                setCart([]);
                setReceipt(result.sale);
                setCashOpen(false);
                setNotice({
                  tone: "ok",
                  text:
                    result.sale.changeCents === 0
                      ? "Venta registrada. El pago fue exacto."
                      : `Venta registrada. Entrega ${formatQ(result.sale.changeCents)} de cambio.`,
                });
              }}
            >
              Registrar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
    oscillator.stop(context.currentTime + 0.09);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // El navegador puede bloquear el audio hasta el siguiente gesto.
  }
}
