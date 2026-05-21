import { ValidationError } from "../../platform/contracts/errors.js";
import type { DomainRegistryService } from "../registry/domain-registry-service.js";
import type { DomainDefinition } from "../registry/domain-model.js";
import { type DomainOnboardingPhase, type DomainOnboardingRecord, nextOnboardingPhase } from "./index.js";

const PHASE_SEQUENCE: readonly DomainOnboardingPhase[] = [
  "domain_modeling",
  "pack_development",
  "security_certification",
  "gray_rollout",
];

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

export class DomainOnboardingService {
  private readonly sessions = new Map<string, DomainOnboardingRecord[]>();
  private readonly rollbackHistory = new Map<string, RollbackPoint[]>();

  public constructor(private readonly registry: DomainRegistryService) {}

  public start(domainId: string): DomainOnboardingSession {
    this.ensureDomainExists(domainId);
    if (!this.sessions.has(domainId)) {
      this.sessions.set(domainId, [
        {
          domainId,
          phase: "domain_modeling",
          status: "in_progress",
          evidenceArtifactIds: [],
        },
      ]);
    }
    return this.get(domainId);
  }

  public advance(domainId: string, evidenceArtifactIds: readonly string[]): DomainOnboardingSession {
    const records = [...this.requireSession(domainId)];
    const current = records.find((item) => item.status === "in_progress")
      ?? records.find((item) => item.status === "blocked");
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
      this.promoteDomainToRegisteredIfNeeded(domainId);
      const domain = this.registry.get(domainId);
      if (domain?.status !== "active") {
        this.registry.activate(domainId);
      }
      return this.get(domainId);
    }

    const existingNext = replaced.find((item) => item.phase === nextPhase);
    if (existingNext != null) {
      const reopenedNext: DomainOnboardingRecord = {
        ...existingNext,
        status: "in_progress",
      };
      this.sessions.set(
        domainId,
        replaced.map((item) => item.phase === nextPhase ? reopenedNext : item),
      );
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

  public rollback(domainId: string, toPhase: DomainOnboardingPhase, checkpointArtifactId: string, reason: string): DomainOnboardingSession {
    const records = [...this.requireSession(domainId)];
    const current = records.find((item) => item.status === "in_progress")
      ?? records.find((item) => item.status === "blocked");
    if (current == null) {
      throw this.validationError("domain_onboarding.no_active_phase", "No active onboarding phase exists.");
    }

    const rollbackPoint: RollbackPoint = {
      phase: current.phase,
      checkpointArtifactId,
      createdAt: new Date().toISOString(),
      reason,
    };
    const history = this.rollbackHistory.get(domainId) ?? [];
    this.rollbackHistory.set(domainId, [...history, rollbackPoint]);

    const rollbackRecords: DomainOnboardingRecord[] = records.map((item) => {
      if (item.phase === toPhase) {
        return {
          ...item,
          status: "in_progress",
          evidenceArtifactIds: [...new Set([...item.evidenceArtifactIds, checkpointArtifactId])],
        };
      }
      if (compareOnboardingPhase(item.phase, toPhase) > 0) {
        return { ...item, status: "pending" };
      }
      return item;
    });
    this.sessions.set(domainId, rollbackRecords);
    return this.get(domainId);
  }

  public get(domainId: string): DomainOnboardingSession {
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

  private promoteDomainToRegisteredIfNeeded(domainId: string): void {
    const domain = this.registry.get(domainId);
    if (domain == null) {
      throw this.validationError("domain_onboarding.domain_not_found", `Domain ${domainId} is not registered.`);
    }
    if (domain.status === "draft" || domain.status === "validated") {
      this.registry.register({
        ...domain,
        status: "registered",
      });
    }
  }

  private validationError(code: string, message: string): ValidationError {
    return new ValidationError(code, message, {
      category: "validation",
      source: "internal",
    });
  }
}

function compareOnboardingPhase(left: DomainOnboardingPhase, right: DomainOnboardingPhase): number {
  return PHASE_SEQUENCE.indexOf(left) - PHASE_SEQUENCE.indexOf(right);
}
