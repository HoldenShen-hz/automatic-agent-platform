// Seeded positive sample: real wall-clock / PRNG calls in business code.
// The audit:determinism script MUST report this.
export function badId(): string {
  return `id-${Date.now()}-${Math.random()}`;
}

export function badTimestamp(): number {
  return new Date().getTime();
}

export function badNowDate(): Date {
  return new Date();
}
