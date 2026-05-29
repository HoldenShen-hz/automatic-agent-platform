import type { DomainUIConfig, FeatureGuardContext, FieldVisibilityPolicy, RedactionLevel, RouteGuardChain } from "@aa/shared-types";
export declare function createFeatureGuardContext(overrides?: Partial<FeatureGuardContext>): FeatureGuardContext;
export interface RouteGuardChainOptions {
    readonly requiredRoles?: readonly string[];
    readonly allowedDomains?: readonly string[];
    readonly featureFlag?: string;
    readonly featureId?: string;
    readonly requireEnterpriseMode?: boolean;
}
export declare function createRouteGuardChain(permission: string, featureFlag?: string, options?: RouteGuardChainOptions): RouteGuardChain;
export declare function createDomainUiConfig(domainId: string, overrides?: Partial<DomainUIConfig>): DomainUIConfig;
export declare function applyRedaction(policy: FieldVisibilityPolicy, fieldPath: string, roleLevel: string, value: unknown): unknown;
export declare function selectRedactionLevel(policy: FieldVisibilityPolicy, fieldPath: string, roleLevel: string): RedactionLevel;
