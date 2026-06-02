// Seeded positive sample: execution plane importing orchestration (forbidden per §7.1).
// The audit:architecture-boundary script MUST report this.
import { plannerService } from "../../../src/platform/five-plane-orchestration/planner/index.js";

export function callPlanner(): unknown {
  return plannerService.plan();
}
