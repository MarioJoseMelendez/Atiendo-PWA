import type { KeyStatuses, Provider } from "./ai";
import { isStore } from "./storage";
import type { Store } from "./types";

export type RemoteDb = {
  ok: true;
  store: Store | null;
  keys: KeyStatuses;
  updatedAt: string;
};

const EMPTY_KEYS: KeyStatuses = {
  nvidia: { configured: false, hint: "" },
  openrouter: { configured: false, hint: "" },
};

export async function fetchRemoteDb(): Promise<RemoteDb | null> {
  try {
    const response = await fetch("/api/db", { cache: "no-store" });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const data = payload as Partial<RemoteDb>;
    if (data.ok !== true) return null;
    return {
      ok: true,
      store: isStore(data.store) ? data.store : null,
      keys: data.keys ?? EMPTY_KEYS,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export async function pushStore(store: Store): Promise<boolean> {
  try {
    const body = JSON.stringify({ store });
    const response = await fetch("/api/db", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: body.length < 60_000,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function saveRemoteKey(
  provider: Provider,
  key: string,
): Promise<KeyStatuses | null> {
  try {
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const data = payload as { ok?: unknown; keys?: unknown };
    if (data.ok !== true || !data.keys || typeof data.keys !== "object") return null;
    return data.keys as KeyStatuses;
  } catch {
    return null;
  }
}
