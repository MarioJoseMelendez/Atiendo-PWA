export function parseInteger(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export function parseQuetzales(input: string): number | null {
  let text = input.trim().replace(/\s/g, "");
  if (!text) return null;
  text = text.replace(/^GTQ/i, "").replace(/^Q/i, "");
  if (!text) return null;

  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length !== 2) return null;
    text = `${parts[0]}.${parts[1]}`;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function formatQ(cents: number): string {
  const amount = (cents / 100).toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Q${amount}`;
}

export function quetzalesInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function roundUpCents(cents: number, step: number): number {
  if (step <= 0) return cents;
  return Math.ceil(cents / step) * step;
}

export function cashSuggestions(totalCents: number): number[] {
  const amounts = new Set<number>([totalCents]);
  for (const step of [1000, 2000, 5000, 10000]) {
    const rounded = roundUpCents(totalCents, step);
    if (rounded > totalCents) amounts.add(rounded);
  }
  return [...amounts].sort((a, b) => a - b);
}
