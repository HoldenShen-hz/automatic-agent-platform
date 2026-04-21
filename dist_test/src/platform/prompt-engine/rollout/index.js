import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class PromptRolloutService {
    rollouts = new Map();
    createRollout(input) {
        const now = nowIso();
        const decision = this.evaluateGuardrail({
            mode: input.mode,
            regressionPassed: input.regressionPassed,
            domainBlockCompatible: input.domainBlockCompatible,
        });
        const record = {
            rolloutId: newId("prompt_rollout"),
            templateKey: input.template.templateKey,
            version: input.template.version,
            mode: input.mode,
            status: decision.allowed ? "ready" : "blocked",
            owner: input.owner.trim(),
            fixedPrefixHash: input.template.fixedPrefixHash,
            regressionSuiteId: input.regressionSuiteId.trim(),
            regressionPassed: input.regressionPassed,
            guardrailSummary: decision.reason,
            createdAt: now,
            updatedAt: now,
        };
        this.rollouts.set(record.rolloutId, record);
        return record;
    }
    activateRollout(rolloutId) {
        const record = this.getRequired(rolloutId);
        if (record.status !== "ready") {
            throw new ValidationError(`prompt_rollout.invalid_transition:${record.status}->active`, `Prompt rollout in status ${record.status} cannot transition to active.`);
        }
        const updated = { ...record, status: "active", updatedAt: nowIso() };
        this.rollouts.set(rolloutId, updated);
        return updated;
    }
    rollbackRollout(rolloutId, reason) {
        const record = this.getRequired(rolloutId);
        const updated = {
            ...record,
            status: "rolled_back",
            guardrailSummary: reason.trim(),
            updatedAt: nowIso(),
        };
        this.rollouts.set(rolloutId, updated);
        return updated;
    }
    evaluateGuardrail(input) {
        if (!input.regressionPassed) {
            return { allowed: false, nextStatus: "blocked", reason: "regression_gate_failed" };
        }
        if (!input.domainBlockCompatible) {
            return { allowed: false, nextStatus: "blocked", reason: "domain_block_incompatible" };
        }
        if (input.mode === "shadow") {
            return { allowed: true, nextStatus: "ready", reason: "shadow_guardrail_passed" };
        }
        return { allowed: true, nextStatus: "ready", reason: "rollout_guardrail_passed" };
    }
    listRollouts(templateKey) {
        const all = [...this.rollouts.values()];
        return all.filter((record) => templateKey == null || record.templateKey === templateKey);
    }
    getRequired(rolloutId) {
        const record = this.rollouts.get(rolloutId);
        if (record == null) {
            throw new ValidationError(`prompt_rollout.not_found:${rolloutId}`, `Prompt rollout ${rolloutId} was not found.`);
        }
        return record;
    }
}
export * from "./platform-prompt-release-orchestration-service.js";
//# sourceMappingURL=index.js.map