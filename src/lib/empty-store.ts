import type { Store } from "./types";

export function createEmptyStore(): Store {
  return { version: 1, groups: [], products: [], sales: [] };
}
