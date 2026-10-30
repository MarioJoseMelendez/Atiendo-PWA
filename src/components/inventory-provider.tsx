"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { guatemalaDayKey, guatemalaStamp } from "@/lib/dates";
import {
  adjustStock,
  applySale,
  deleteGroup,
  deleteProduct,
  saveGroup,
  saveProduct,
} from "@/lib/inventory";
import { createEmptyStore } from "@/lib/empty-store";
import { importInventoryDraft, type InventoryDraft } from "@/lib/import";
import { fetchRemoteDb, pushStore } from "@/lib/remote";
import { loadStore, saveStore } from "@/lib/storage";
import type { CartLine, GroupInput, ProductInput, Sale, Store } from "@/lib/types";

type ChargeResult = { ok: true; sale: Sale } | { ok: false; error: string };
type ImportDraftResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string };

type InventoryContextValue = {
  ready: boolean;
  store: Store;
  saveGroupDraft: (input: GroupInput, id?: string) => string | null;
  removeGroup: (id: string) => string | null;
  saveProductDraft: (input: ProductInput, id?: string) => string | null;
  importDraft: (draft: InventoryDraft) => ImportDraftResult;
  removeProduct: (id: string) => string | null;
  changeStock: (id: string, delta: number) => string | null;
  chargeCash: (lines: CartLine[], tenderedCents: number) => ChargeResult;
};

const SERVER_STORE = createEmptyStore();
let clientStore: Store | null = null;
let localWrites = 0;

function readClientStore(): Store {
  if (!clientStore) clientStore = loadStore() ?? createEmptyStore();
  return clientStore;
}

function writeClientStore(next: Store): void {
  localWrites += 1;
  clientStore = next;
  saveStore(next);
  window.dispatchEvent(new Event("atiendo-store"));
  void pushStore(next);
}

function subscribeStore(callback: () => void): () => void {
  window.addEventListener("atiendo-store", callback);
  const id = window.setTimeout(callback, 0);
  return () => {
    window.removeEventListener("atiendo-store", callback);
    window.clearTimeout(id);
  };
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const store = useSyncExternalStore(subscribeStore, readClientStore, () => SERVER_STORE);

  useEffect(() => {
    let cancelled = false;
    const local = loadStore();
    if (local) {
      void pushStore(local);
      return () => {
        cancelled = true;
      };
    }
    void fetchRemoteDb().then((remote) => {
      if (cancelled || localWrites > 0 || !remote?.store) return;
      clientStore = remote.store;
      saveStore(remote.store);
      window.dispatchEvent(new Event("atiendo-store"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      importDraft: (draft) => {
        const result = importInventoryDraft(readClientStore(), draft, {
          createId: () => crypto.randomUUID(),
        });
        if (!result.ok) return result;
        commit(result.store);
        return { ok: true, imported: result.imported, skipped: result.skipped };
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
    };
  }, [store]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const value = useContext(InventoryContext);
  if (!value) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return value;
}
