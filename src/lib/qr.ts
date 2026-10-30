const PREFIX = "atiendo:";
const LEGACY_PREFIX = "estante:";

export function encodeQr(code: string): string {
  return `${PREFIX}${code.trim().toUpperCase()}`;
}

export function decodeQr(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const prefix = lower.startsWith(PREFIX)
    ? PREFIX
    : lower.startsWith(LEGACY_PREFIX)
      ? LEGACY_PREFIX
      : null;
  const source = prefix ? text.slice(prefix.length).trim() : text;

  const code = source.toUpperCase();
  if (!/^[A-Z]{2,4}-\d{3,}$/.test(code)) return null;
  return code;
}
