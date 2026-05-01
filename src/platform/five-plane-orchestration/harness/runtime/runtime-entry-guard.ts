import { ValidationError } from "../../../contracts/errors.js";
import type { PlanGraphBundle } from "../../../contracts/executable-contracts/index.js";

export interface RuntimeEntryGuardResult {
  readonly accepted: true;
  readonly planGraphBundle: PlanGraphBundle;
}

export class RuntimeEntryGuard {
  public assertPlanGraphBundleOnly(input: unknown): RuntimeEntryGuardResult {
    if (!isPlanGraphBundle(input)) {
      throw new ValidationError(
        "runtime_entry_guard.plan_graph_bundle_required",
        "Runtime execution entry only accepts PlanGraphBundle.",
      );
    }
    return {
      accepted: true,
      planGraphBundle: input,
    };
  }

  /**
 * @deprecated Use RuntimeTruthRepository.assertNoLegacyTruthWrite() for compile-time enforcement.
 * This method only provides runtime checks. For build-time @deprecated enforcement on legacy imports,
 * use the ESLint no-restricted-imports rule configured in eslint.config.js.
 */
public assertNoLegacyTruthWrite(input: { readonly contractName?: string; readonly eventType?: string }): void {
    const legacyContractNames = new Set(["ExecutionPlan", "ExecutionReceipt", "ControlDirective", "WorkflowStep", "StepOutput"]);
    if (input.contractName != null && legacyContractNames.has(input.contractName)) {
      throw new ValidationError(
        "runtime_entry_guard.legacy_contract_forbidden",
        "Legacy execution contracts cannot write v4.3 runtime truth.",
      );
    }
    if (input.eventType != null && !input.eventType.startsWith("platform.")) {
      throw new ValidationError(
        "runtime_entry_guard.platform_fact_required",
        "Runtime truth writes must be backed by platform.* fact events.",
      );
    }
  }
}

function isPlanGraphBundle(input: unknown): input is PlanGraphBundle {
  if (typeof input !== "object" || input == null) {
    return false;
  }
  const candidate = input as Partial<PlanGraphBundle>;
  return (
    typeof candidate.planGraphBundleId === "string" &&
    typeof candidate.harnessRunId === "string" &&
    typeof candidate.graphVersion === "number" &&
    typeof candidate.graph === "object" &&
    candidate.graph != null
  );
}
