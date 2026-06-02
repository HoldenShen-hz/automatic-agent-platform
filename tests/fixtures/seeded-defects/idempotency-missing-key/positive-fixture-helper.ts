// Helper module used by the idempotency evasion seed. Provides a
// bare `commit` writer that the audit will see as a write call.
export const something = { commit: async (_p: unknown): Promise<void> => {} };
