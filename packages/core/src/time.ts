/**
 * Helpers for working with OTLP unix-nanosecond timestamps, which are kept as
 * strings throughout the model to avoid the precision loss of `number`
 * (absolute nanos exceed `Number.MAX_SAFE_INTEGER`).
 */

const NANOS_PER_MS = 1_000_000n;

function toBigInt(nano: string): bigint {
  try {
    return BigInt(nano);
  } catch {
    return 0n;
  }
}

/** Compare two nanosecond timestamps. Suitable as an `Array#sort` comparator. */
export function compareNano(a: string, b: string): number {
  const an = toBigInt(a);
  const bn = toBigInt(b);
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
}

/** Duration between two nanosecond timestamps, in milliseconds (float). */
export function durationMs(startNano: string, endNano: string): number {
  const diff = toBigInt(endNano) - toBigInt(startNano);
  if (diff <= 0n) return 0;
  // Whole millis without precision loss, then add the fractional part.
  const whole = diff / NANOS_PER_MS;
  const rem = diff % NANOS_PER_MS;
  return Number(whole) + Number(rem) / 1_000_000;
}

/** Convert a nanosecond timestamp to epoch milliseconds (float). */
export function nanoToEpochMs(nano: string): number {
  const n = toBigInt(nano);
  const whole = n / NANOS_PER_MS;
  const rem = n % NANOS_PER_MS;
  return Number(whole) + Number(rem) / 1_000_000;
}
