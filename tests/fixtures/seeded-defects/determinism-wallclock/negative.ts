// Seeded negative sample: Clock is injected; randomness is from a PRNG.
// The audit:determinism script MUST NOT report this.
export interface Clock {
  now(): number;
}
export interface Prng {
  next(): number;
}

export function goodId(clock: Clock, prng: Prng): string {
  return `id-${clock.now()}-${prng.next()}`;
}

export function goodTimestamp(clock: Clock): number {
  return clock.now();
}
