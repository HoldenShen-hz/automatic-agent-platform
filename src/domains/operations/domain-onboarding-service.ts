import { ValidationError } from "../../platform/contracts/errors.js";
import type { DomainRegistryService } from "../registry/domain-registry-service.js";
import type { DomainDefinition } from "../registry/domain-model.js";
import { type DomainOnboardingPhase, type DomainOnboardingRecord, nextOnboardingPhase } from "./index.js";

export interface DomainOnboardingSession {
  readonly domainId: string;
  readonly records: readonly DomainOnboardingRecord[];
  readonly activePhase: DomainOnboardingPhase | null;
  readonly completed: boolean;
  readonly activatedDomainStatus: DomainDefinition["status"] | null;
}

export class DomainOnboardingService {
  private readonly sessions = new Map<string, DomainOnboardingRecord[]>();

  public constructor(private readonly registry: DomainRegistryService) {}

  public start(domainId: string): DomainOnboardingSession {
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

  public advance(domainId: string, evidenceArtifactIds: readonly string[]): DomainOnboardingSession {
    const records = [...this.requireSession(domainId)];
    const current = records.find((item) => item.status === "in_progress");
    if (current == null) {
      throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
    }
    if (evidenceArtifactIds.length === 0) {
      throw this.validationError("domain_onboarding.evidence_required", "Onboarding phase completion requires evidence.");
    }

    const updatedCurrent: DomainOnboardingRecord = {
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

    const nextRecord: DomainOnboardingRecord = {
      domainId,
      phase: nextPhase,
      status: "in_progress",
      evidenceArtifactIds: [],
    };
    this.sessions.set(domainId, [...replaced, nextRecord]);
    return this.get(domainId);
  }

  public block(domainId: string, reasonArtifactId: string): DomainOnboardingSession {
    const records = [...this.requireSession(domainId)];
    const current = records.find((item) => item.status === "in_progress");
    if (current == null) {
      throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
    }
    const updatedCurrent: DomainOnboardingRecord = {
      ...current,
      status: "blocked",
      evidenceArtifactIds: [...new Set([...current.evidenceArtifactIds, reasonArtifactId])],
    };
    this.sessions.set(domainId, records.map((item) => item.phase === current.phase ? updatedCurrent : item));
    return this.get(domainId);
  }

  public get(domainId: string): DomainOnboardingSession {
    this.ensureDomainExists(domainId);
    const records = this.sessions.get(domainId) ?? [];
    const domain = this.registry.get(domainId);
    return {
      domainId,
      records,
      activePhase: records.find((item) => item.status === "in_progress")?.phase ?? null,
      completed: records.length > 0 && records.every((item) => item.status === "completed"),
      activatedDomainStatus: domain?.status ?? null,
    };
  }

  public list(): DomainOnboardingSession[] {
    return [...this.sessions.keys()].sort().map((domainId) => this.get(domainId));
  }

  private ensureDomainExists(domainId: string): void {
    if (this.registry.get(domainId) == null) {
      throw this.validationError("domain_onboarding.domain_not_found", `Domain ${domainId} is not registered.`);
    }
  }

  private requireSession(domainId: string): DomainOnboardingRecord[] {
    this.ensureDomainExists(domainId);
    const session = this.sessions.get(domainId);
    if (session == null) {
      throw this.validationError("domain_onboarding.session_not_started", "Onboarding session has not been started.");
    }
    return session;
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}
