import { type ForensicSnapshot } from "./forensic-snapshot/index.js";
import { type PanicDirectiveInput } from "./panic-controller/index.js";
import { type ResumePlan } from "./resume-protocol/index.js";
export type PanicFreezeMode = "deploy" | "approval" | "write" | "automation";
export interface PlatformPanicDirective {
    readonly directiveId: string;
    readonly scope: string;
    readonly reasonCode: string;
    readonly issuedBy: string;
    readonly issuedAt: string;
    readonly freezeModes: readonly PanicFreezeMode[];
    readonly allowList?: readonly string[];
}
export interface PanicPropagationRecord {
    readonly directiveId: string;
    readonly targetScope: string;
    readonly propagationMode: "direct" | "inherited";
    readonly blockedExecutionModes: readonly PanicFreezeMode[];
    readonly recordedAt: string;
}
export interface PanicActivationRequest extends PanicDirectiveInput {
    readonly issuedBy: string;
    readonly issuedAt?: string;
    readonly freezeModes?: readonly PanicFreezeMode[];
    readonly allowList?: readonly string[];
    readonly targetScopes?: readonly string[];
    readonly forensicArtifactIds?: readonly string[];
}
export interface PanicExecutionCheck {
    readonly scope: string;
    readonly mode: PanicFreezeMode;
    readonly actorId?: string;
}
export interface PanicExecutionDecision {
    readonly blocked: boolean;
    readonly directiveId: string | null;
    readonly reasonCodes: readonly string[];
}
export interface PanicResumeReceipt {
    readonly scope: string;
    readonly resumed: boolean;
    readonly resumedAt: string | null;
    readonly directiveId: string | null;
    readonly reasonCodes: readonly string[];
}
export interface PlatformPanicActivation {
    readonly directive: PlatformPanicDirective;
    readonly propagationRecords: readonly PanicPropagationRecord[];
    readonly forensicSnapshot: ForensicSnapshot;
}
export declare class PlatformPanicService {
    private readonly activations;
    private readonly resumeReceipts;
    activate(request: PanicActivationRequest): PlatformPanicActivation;
    getActive(scope: string): PlatformPanicActivation | null;
    listActive(): PlatformPanicActivation[];
    evaluateExecution(check: PanicExecutionCheck): PanicExecutionDecision;
    resume(scope: string, plan: ResumePlan, resumedAt?: string): PanicResumeReceipt;
    getResumeReceipt(scope: string): PanicResumeReceipt | null;
    private resolveActivation;
}
