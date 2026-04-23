export type ControlDirectiveKind = "pause" | "resume" | "cancel" | "rollback" | "escalate";
export interface ControlDirective {
    directiveId: string;
    kind: ControlDirectiveKind;
    targetRef: string;
    reasonCode: string;
    issuedBy: string;
    tenantId: string | null;
    executionId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}
export declare function createControlDirective(input: Omit<ControlDirective, "directiveId" | "createdAt"> & {
    directiveId?: string;
    createdAt?: string;
}): ControlDirective;
