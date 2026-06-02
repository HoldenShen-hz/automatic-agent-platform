// Seeded negative sample: a write-like call wrapped in withIdempotencyKey.
// The audit:idempotency script MUST NOT report this.
export async function commitWithKey(): Promise<void> {
  await withIdempotencyKey("user-alice-amount-100", () => something.commit({ user: "alice", amount: 100 }));
}
export const something = { commit: async (_p: unknown): Promise<void> => {} };
export async function withIdempotencyKey<T>(_k: string, fn: () => Promise<T>): Promise<T> { return fn(); }
