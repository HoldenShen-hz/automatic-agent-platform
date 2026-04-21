import { ValidationError } from "../../platform/contracts/errors.js";
import { nextOnboardingPhase } from "./index.js";
export class DomainOnboardingService {
    registry;
    sessions = new Map();
    rollbackHistory = new Map();
    constructor(registry) {
        this.registry = registry;
    }
    start(domainId) {
        this.ensureDomainExists(domainId);
        if (!this.sessions.has(domainId)) {
            this.sessions.set(domainId, [
                {
                    domainId,
                    phase: "modeling",
                    status: "in_progress",
                    evidenceArtifactIds: [],
                },
            ]);
        }
        return this.get(domainId);
    }
    advance(domainId, evidenceArtifactIds) {
        const records = [...this.requireSession(domainId)];
        const current = records.find((item) => item.status === "in_progress");
        if (current == null) {
            throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
        }
        if (evidenceArtifactIds.length === 0) {
            throw this.validationError("domain_onboarding.evidence_required", "Onboarding phase completion requires evidence.");
        }
        const updatedCurrent = {
            ...current,
            status: "completed",
            evidenceArtifactIds: [...new Set([...current.evidenceArtifactIds, ...evidenceArtifactIds])],
        };
        const replaced = records.map((item) => item.phase === current.phase ? updatedCurrent : item);
        const nextPhase = nextOnboardingPhase(current.phase);
        if (nextPhase == null) {
            this.sessions.set(domainId, replaced);
            this.registry.activate(domainId);
            return this.get(domainId);
        }
        const nextRecord = {
            domainId,
            phase: nextPhase,
            status: "in_progress",
            evidenceArtifactIds: [],
        };
        this.sessions.set(domainId, [...replaced, nextRecord]);
        return this.get(domainId);
    }
    block(domainId, reasonArtifactId) {
        const records = [...this.requireSession(domainId)];
        const current = records.find((item) => item.status === "in_progress");
        if (current == null) {
            throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
        }
        const updatedCurrent = {
            ...current,
            status: "blocked",
            evidenceArtifactIds: [...new Set([...current.evidenceArtifactIds, reasonArtifactId])],
        };
        this.sessions.set(domainId, records.map((item) => item.phase === current.phase ? updatedCurrent : item));
        return this.get(domainId);
    }
    rollback(domainId, toPhase, checkpointArtifactId, reason) {
        const records = [...this.requireSession(domainId)];
        const current = records.find((item) => item.status === "in_progress");
        if (current == null) {
            throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
        }
        const rollbackPoint = {
            phase: current.phase,
            checkpointArtifactId,
            createdAt: new Date().toISOString(),
            reason,
        };
        const history = this.rollbackHistory.get(domainId) ?? [];
        this.rollbackHistory.set(domainId, [...history, rollbackPoint]);
        const rollbackRecords = records.map((item) => {
            if (item.phase === current.phase) {
                return { ...item, status: "in_progress", evidenceArtifactIds: [checkpointArtifactId] };
            }
            if (item.phase === toPhase) {
                return { ...item, status: "in_progress", evidenceArtifactIds: [] };
            }
            return { ...item, status: "pending" };
        });
        this.sessions.set(domainId, rollbackRecords);
        return this.get(domainId);
    }
    get(domainId) {
        this.ensureDomainExists(domainId);
        const records = this.sessions.get(domainId) ?? [];
        const domain = this.registry.get(domainId);
        const history = this.rollbackHistory.get(domainId) ?? [];
        return {
            domainId,
            records,
            activePhase: records.find((item) => item.status === "in_progress")?.phase ?? null,
            completed: records.length > 0 && records.every((item) => item.status === "completed"),
            activatedDomainStatus: domain?.status ?? null,
            rollbackHistory: history,
        };
    }
    list() {
        return [...this.sessions.keys()].sort().map((domainId) => this.get(domainId));
    }
    ensureDomainExists(domainId) {
        if (this.registry.get(domainId) == null) {
            throw this.validationError("domain_onboarding.domain_not_found", `Domain ${domainId} is not registered.`);
        }
    }
    requireSession(domainId) {
        this.ensureDomainExists(domainId);
        const session = this.sessions.get(domainId);
        if (session == null) {
            throw this.validationError("domain_onboarding.session_not_started", "Onboarding session has not been started.");
        }
        return session;
    }
    validationError(code, message) {
        return new ValidationError(code, message, {
            category: "validation",
            source: "internal",
        });
    }
}
//# sourceMappingURL=domain-onboarding-service.js.map