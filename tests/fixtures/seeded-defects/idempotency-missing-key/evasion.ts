// Seeded evasion sample: the write method is invoked via a local helper
// that holds the `.commit(` text, but the helper itself is not
// idempotency-aware. The audit:idempotency script MUST still report this
// because the call site has no idempotency key.
import { something } from "./positive-fixture-helper.js";

export function commitEvasion(): void {
  // The call site has no idempotency key — the wrap into a helper
  // does not count as one.
  something.commit({ user: "alice" });
}
