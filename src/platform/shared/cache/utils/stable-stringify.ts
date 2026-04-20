/**
 * Stable Stringify Utility
 *
 * Provides deterministic JSON serialization that ensures equal objects
 * produce equal strings regardless of key order.
 */

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();

  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted = Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const v = obj[key];
        if (v !== undefined) {
          acc[key] = sortValue(v);
        }
        return acc;
      }, {});
    return sorted;
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  return value;
}

export function stableEquals(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
