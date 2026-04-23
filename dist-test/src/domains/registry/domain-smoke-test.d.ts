import type { DomainDefinition } from "./domain-model.js";
export interface SmokTestRuntimeCheck {
    checkId: string;
    passed: boolean;
    details: string;
}
export interface DomainSmokeTestResult {
    passed: boolean;
    issues: string[];
    runtimeChecks: SmokTestRuntimeCheck[];
    rollbackPoints: readonly string[];
}
export declare class DomainSmokeTestRunner {
    run(definition: DomainDefinition): DomainSmokeTestResult;
    private validateDependencyGraph;
    private validateSandboxCompatibility;
    private validateResourceQuotas;
    private computeRollbackPoints;
}
