export interface ToolbeltAssemblyRequest {
    readonly allowedTools: readonly string[];
    readonly requestedTools: readonly string[];
    readonly requiredEvidence: readonly string[];
}
export interface HarnessToolbelt {
    readonly allowedTools: readonly string[];
    readonly grantedTools: readonly string[];
    readonly blockedTools: readonly string[];
    readonly requiredEvidence: readonly string[];
}
export declare class ToolbeltAssembler {
    assemble(request: ToolbeltAssemblyRequest): HarnessToolbelt;
}
