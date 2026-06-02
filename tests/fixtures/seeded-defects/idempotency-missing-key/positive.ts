// Seeded positive sample: a write-like call without an idempotency key.
// The audit:idempotency script MUST report this.
export function commitWithoutKey(): void {
  void something.commit({ user: "alice", amount: 100 });
}
export const something = { commit: async (_p: unknown): Promise<void> => {} };
