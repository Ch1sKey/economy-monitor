const SCALE = 4;

function normalizeSign(raw: string): { neg: boolean; body: string } {
  let s = raw.trim();
  if (!s) return { neg: false, body: "0" };
  let neg = false;
  if (s[0] === "-") {
    neg = true;
    s = s.slice(1).trim();
  } else if (s[0] === "+") {
    s = s.slice(1).trim();
  }
  return { neg, body: s || "0" };
}

/** Parse DECIMAL string to scaled bigint (4 decimal places). */
export function decimalToScaled(value: string | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  const { neg, body } = normalizeSign(String(value));
  const [intPartRaw, fracRaw = ""] = body.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const frac = (fracRaw + "0".repeat(SCALE)).slice(0, SCALE);
  const combined = `${intPart}${frac}`.replace(/^0+(?=\d)/, "") || "0";
  const n = BigInt(combined);
  return neg ? -n : n;
}

export function scaledToDecimalString(scaled: bigint): string {
  const neg = scaled < 0n;
  const abs = neg ? -scaled : scaled;
  const s = abs.toString().padStart(SCALE + 1, "0");
  const intPart = s.slice(0, -SCALE) || "0";
  const frac = s.slice(-SCALE);
  const trimmedFrac = frac.replace(/0+$/, "");
  const core = trimmedFrac.length ? `${intPart}.${trimmedFrac}` : intPart;
  return neg ? `-${core}` : core;
}

export function addDecimalStrings(a: string, b: string): string {
  return scaledToDecimalString(decimalToScaled(a) + decimalToScaled(b));
}

export function subDecimalStrings(a: string, b: string): string {
  return scaledToDecimalString(decimalToScaled(a) - decimalToScaled(b));
}

export function isZeroDecimal(value: string | null | undefined): boolean {
  return decimalToScaled(value) === 0n;
}

export function compareDecimal(a: string, b: string): number {
  const d = decimalToScaled(a) - decimalToScaled(b);
  if (d < 0n) return -1;
  if (d > 0n) return 1;
  return 0;
}
