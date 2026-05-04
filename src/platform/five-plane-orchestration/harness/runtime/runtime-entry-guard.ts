import { ValidationError } from "../../../contracts/errors.js";
import type { PlanGraphBundle } from "../../../contracts/executable-contracts/index.js";
import { LEGACY_CONTRACT_NAMES } from "../../../contracts/executable-contracts/index.js";

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
 *
 * R6-24 FIX: This method now emits a console warning at runtime to aid migration.
 * The console.warn message includes migration guidance per §4.3.
 */
public assertNoLegacyTruthWrite(input: { readonly contractName?: string; readonly eventType?: string }): void {
    // R6-24 FIX: Emit runtime warning for migration aid
    // Use LEGACY_CONTRACT_NAMES from executable-contracts for consistent enforcement
    if (input.contractName != null && LEGACY_CONTRACT_NAMES.includes(input.contractName as any)) {
      console.warn(
        `[DEPRECATION] Legacy contract '${input.contractName}' used. ` +
        `Migrate to canonical contracts per §4.3. ` +
        `Use PlanGraphBundle instead of ExecutionPlan, NodeAttemptReceipt instead of ExecutionReceipt, ` +
        `OperationalDirective/DecisionDirective instead of ControlDirective.`,
      );
      throw new ValidationError(
        "runtime_entry_guard.legacy_contract_forbidden",
        "Legacy execution contracts cannot write v4.3 runtime truth.",
      );
    }
    if (input.eventType != null && !input.eventType.startsWith("platform.")) {
      console.warn(
        `[DEPRECATION] Non-platform event type '${input.eventType}' used for truth write. ` +
        `Runtime truth writes must use platform.* fact events per §28.1.`,
      );
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
