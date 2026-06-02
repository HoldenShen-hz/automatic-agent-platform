// Seeded positive sample: a bare Promise-returning call that is not awaited.
// The audit:fire-and-forget script MUST report this.
export function fireIt(): void {
  something.publish("hi");
}
export const something = { publish: async (_msg: string): Promise<void> => {} };
