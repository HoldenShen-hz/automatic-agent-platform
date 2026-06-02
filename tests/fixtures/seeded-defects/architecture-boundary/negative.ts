// Seeded negative sample: execution plane importing contracts/shared (allowed per §7.1).
// The audit:architecture-boundary script MUST NOT report this.
import { sharedContract } from "../../../src/platform/shared/index.js";

export function useShared(): unknown {
  return sharedContract;
}
