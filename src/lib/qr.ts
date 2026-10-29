const PREFIX = "estante:";

export function encodeQr(code: string): string {
  return `${PREFIX}${code.trim().toUpperCase()}`;
}

export function decodeQr(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const source = text.toLowerCase().startsWith(PREFIX)
    ? text.slice(PREFIX.length).trim()
    : text;

  const code = source.toUpperCase();
  if (!/^[A-Z]{2,4}-\d{3,}$/.test(code)) return null;
  return code;
}
