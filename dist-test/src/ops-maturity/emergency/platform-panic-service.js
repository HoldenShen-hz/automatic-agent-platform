import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildForensicSnapshot } from "./forensic-snapshot/index.js";
import { shouldEnterPanicMode } from "./panic-controller/index.js";
import { canResumeFromPanic } from "./resume-protocol/index.js";
function matchesScope(activeScope, requestedScope) {
    return requestedScope === activeScope || requestedScope.startsWith(`${activeScope}/`);
}
function defaultFreezeModes(reasonCode) {
    if (reasonCode.startsWith("security.")) {
        return ["deploy", "approval", "write", "automation"];
    }
    return ["deploy", "automation"];
}
export class PlatformPanicService {
    activations = new Map();
    resumeReceipts = new Map();
    activate(request) {
        if (!shouldEnterPanicMode(request)) {
            throw new Error(`panic.directive_rejected:${request.scope}:${request.reasonCode}`);
        }
        const issuedAt = request.issuedAt ?? nowIso();
        const directive = {
            directiveId: newId("panic"),
            scope: request.scope,
            reasonCode: request.reasonCode,
            issuedBy: request.issuedBy,
            issuedAt,
            freezeModes: request.freezeModes ?? defaultFreezeModes(request.reasonCode),
            ...(request.allowList != null ? { allowList: request.allowList } : {}),
        };
        const propagationRecords = (request.targetScopes ?? [request.scope]).map((targetScope) => ({
            directiveId: directive.directiveId,
            targetScope,
            propagationMode: targetScope === request.scope ? "direct" : "inherited",
            blockedExecutionModes: directive.freezeModes,
            recordedAt: issuedAt,
        }));
        const activation = {
            directive,
            propagationRecords,
            forensicSnapshot: buildForensicSnapshot({
                snapshotId: newId("panic_snapshot"),
                scope: request.scope,
                collectedAt: issuedAt,
                artifactIds: request.forensicArtifactIds ?? [],
                runtimeState: {
                    severity: request.severity,
                    triggerSignals: request.triggerSignals,
                },
            }),
        };
        this.activations.set(request.scope, activation);
        this.resumeReceipts.delete(request.scope);
        return activation;
    }
    getActive(scope) {
        return this.activations.get(scope) ?? null;
    }
    listActive() {
        return [...this.activations.values()].sort((left, right) => left.directive.scope.localeCompare(right.directive.scope));
    }
    evaluateExecution(check) {
        const activation = this.resolveActivation(check.scope);
        if (activation == null) {
            return {
                blocked: false,
                directiveId: null,
                reasonCodes: [],
            };
        }
        if (check.actorId != null && activation.directive.allowList?.includes(check.actorId)) {
            return {
                blocked: false,
                directiveId: activation.directive.directiveId,
                reasonCodes: ["panic.allow_list_bypass"],
            };
        }
        if (!activation.directive.freezeModes.includes(check.mode)) {
            return {
                blocked: false,
                directiveId: activation.directive.directiveId,
                reasonCodes: ["panic.mode_not_frozen"],
            };
        }
        return {
            blocked: true,
            directiveId: activation.directive.directiveId,
            reasonCodes: ["panic.execution_blocked", `panic.reason:${activation.directive.reasonCode}`],
        };
    }
    resume(scope, plan, resumedAt = nowIso()) {
        const activation = this.resolveActivation(scope);
        if (activation == null) {
            const missingReceipt = {
                scope,
                resumed: false,
                resumedAt: null,
                directiveId: null,
                reasonCodes: ["panic.directive_not_found"],
            };
            this.resumeReceipts.set(scope, missingReceipt);
            return missingReceipt;
        }
        if (!canResumeFromPanic(plan)) {
            const blockedReceipt = {
                scope,
                resumed: false,
                resumedAt: null,
                directiveId: activation.directive.directiveId,
                reasonCodes: ["panic.resume_checkpoints_incomplete"],
            };
            this.resumeReceipts.set(scope, blockedReceipt);
            return blockedReceipt;
        }
        this.activations.delete(activation.directive.scope);
        const receipt = {
            scope: activation.directive.scope,
            resumed: true,
            resumedAt,
            directiveId: activation.directive.directiveId,
            reasonCodes: ["panic.resumed_explicitly"],
        };
        this.resumeReceipts.set(scope, receipt);
        return receipt;
    }
    getResumeReceipt(scope) {
        return this.resumeReceipts.get(scope) ?? null;
    }
    resolveActivation(scope) {
        const matches = [...this.activations.values()]
            .filter((activation) => activation.propagationRecords.some((record) => matchesScope(record.targetScope, scope)))
            .sort((left, right) => {
            const leftSpecificity = Math.max(...left.propagationRecords
                .filter((record) => matchesScope(record.targetScope, scope))
                .map((record) => record.targetScope.length));
            const rightSpecificity = Math.max(...right.propagationRecords
                .filter((record) => matchesScope(record.targetScope, scope))
                .map((record) => record.targetScope.length));
            return rightSpecificity - leftSpecificity;
        });
        return matches[0] ?? null;
    }
}
//# sourceMappingURL=platform-panic-service.js.map