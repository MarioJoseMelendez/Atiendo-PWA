export type Provider = "nvidia" | "openrouter";

export type KeyStatus = {
  configured: boolean;
  hint: string;
};

export type KeyStatuses = Record<Provider, KeyStatus>;

export function isProvider(value: unknown): value is Provider {
  return value === "nvidia" || value === "openrouter";
}

export function maskKey(key: string): string {
  const value = key.trim();
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `••••${value.slice(-4)}`;
}

export function publicKeyStatuses(keys: {
  nvidia?: string;
  openrouter?: string;
}): KeyStatuses {
  return {
    nvidia: keys.nvidia
      ? { configured: true, hint: maskKey(keys.nvidia) }
      : { configured: false, hint: "" },
    openrouter: keys.openrouter
      ? { configured: true, hint: maskKey(keys.openrouter) }
      : { configured: false, hint: "" },
  };
}

export function providerOrder(
  preferred: Provider,
  keys: Record<Provider, string>,
): Provider[] {
  const order: Provider[] =
    preferred === "openrouter" ? ["openrouter", "nvidia"] : ["nvidia", "openrouter"];
  return order.filter((provider) => keys[provider].trim().length > 0);
}
