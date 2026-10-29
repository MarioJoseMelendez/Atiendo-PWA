"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { guatemalaDayKey, guatemalaStamp } from "@/lib/dates";
import {
  adjustStock,
  applySale,
  deleteGroup,
  deleteProduct,
  saveGroup,
  saveProduct,
} from "@/lib/inventory";
import { createSeed } from "@/lib/seed";
import { loadStore, saveStore } from "@/lib/storage";
import type { CartLine, GroupInput, ProductInput, Sale, Store } from "@/lib/types";

type ChargeResult = { ok: true; sale: Sale } | { ok: false; error: string };

type InventoryContextValue = {
  ready: boolean;
  store: Store;
  saveGroupDraft: (input: GroupInput, id?: string) => string | null;
  removeGroup: (id: string) => string | null;
  saveProductDraft: (input: ProductInput, id?: string) => string | null;
  removeProduct: (id: string) => string | null;
  changeStock: (id: string, delta: number) => string | null;
  chargeCash: (lines: CartLine[], tenderedCents: number) => ChargeResult;
  restoreDemo: () => void;
};

const SERVER_STORE = createSeed();
let clientStore: Store | null = null;

function readClientStore(): Store {
  if (!clientStore) clientStore = loadStore() ?? createSeed();
  return clientStore;
}

function writeClientStore(next: Store): void {
  clientStore = next;
  saveStore(next);
  window.dispatchEvent(new Event("estante-store"));
}

function subscribeStore(callback: () => void): () => void {
  window.addEventListener("estante-store", callback);
  const id = window.setTimeout(callback, 0);
  return () => {
    window.removeEventListener("estante-store", callback);
    window.clearTimeout(id);
  };
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const store = useSyncExternalStore(subscribeStore, readClientStore, () => SERVER_STORE);

  const value = useMemo<InventoryContextValue>(() => {
    const commit = (next: Store) => writeClientStore(next);
    return {
      ready: true,
      store,
      saveGroupDraft: (input, id) => {
        const result = saveGroup(readClientStore(), input, {
          id,
          createId: crypto.randomUUID(),
        });
        if (!result.ok) return result.error;
        commit(result.store);
        return null;
      },
      removeGroup: (id) => {
        const result = deleteGroup(readClientStore(), id);
        if (!result.ok) return result.error;
        commit(result.store);
        return null;
      },
      saveProductDraft: (input, id) => {
        const result = saveProduct(readClientStore(), input, {
          id,
          createId: crypto.randomUUID(),
        });
        if (!result.ok) return result.error;
        commit(result.store);
        return null;
      },
      removeProduct: (id) => {
        const result = deleteProduct(readClientStore(), id);
        if (!result.ok) return result.error;
        commit(result.store);
        return null;
      },
      changeStock: (id, delta) => {
        const result = adjustStock(readClientStore(), id, delta);
        if (!result.ok) return result.error;
        commit(result.store);
        return null;
      },
      chargeCash: (lines, tenderedCents) => {
        const now = new Date();
        const result = applySale(readClientStore(), lines, tenderedCents, {
          id: crypto.randomUUID(),
          at: now.toISOString(),
          dayKey: guatemalaDayKey(now),
          whenLabel: guatemalaStamp(now),
        });
        if (!result.ok) return result;
        commit(result.store);
        return { ok: true, sale: result.sale };
      },
      restoreDemo: () => commit(createSeed()),
    };
  }, [store]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const value = useContext(InventoryContext);
  if (!value) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return value;
}
