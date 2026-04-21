import type { DomainRegistryService } from "../registry/domain-registry-service.js";
import type { DomainDefinition } from "../registry/domain-model.js";
import { type DomainOnboardingPhase, type DomainOnboardingRecord } from "./index.js";
export interface RollbackPoint {
    readonly phase: DomainOnboardingPhase;
    readonly checkpointArtifactId: string;
    readonly createdAt: string;
    readonly reason: string;
}
export interface DomainOnboardingSession {
    readonly domainId: string;
    readonly records: readonly DomainOnboardingRecord[];
    readonly activePhase: DomainOnboardingPhase | null;
    readonly completed: boolean;
    readonly activatedDomainStatus: DomainDefinition["status"] | null;
    readonly rollbackHistory: readonly RollbackPoint[];
}
export declare class DomainOnboardingService {
    private readonly registry;
    private readonly sessions;
    private readonly rollbackHistory;
    constructor(registry: DomainRegistryService);
    start(domainId: string): DomainOnboardingSession;
    advance(domainId: string, evidenceArtifactIds: readonly string[]): DomainOnboardingSession;
    block(domainId: string, reasonArtifactId: string): DomainOnboardingSession;
    rollback(domainId: string, toPhase: DomainOnboardingPhase, checkpointArtifactId: string, reason: string): DomainOnboardingSession;
    get(domainId: string): DomainOnboardingSession;
    list(): DomainOnboardingSession[];
    private ensureDomainExists;
    private requireSession;
    private validationError;
}
