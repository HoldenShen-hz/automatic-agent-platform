export interface PolicyLayer {
    readonly policyId: string;
    readonly rules: Readonly<Record<string, unknown>>;
}
export declare function inheritPolicyLayers(layers: readonly PolicyLayer[]): Record<string, unknown>;
