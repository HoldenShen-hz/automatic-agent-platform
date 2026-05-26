import type { SessionDualStorageService, SessionEvent } from "../../platform/five-plane-state-evidence/truth/session-dual-storage.js";

export interface DomainKnowledgeIntegrationServiceOptions {
  readonly sessionStorage: SessionDualStorageService;
  readonly resolveDomainIdByTaskId: (taskId: string) => string | null;
  readonly listKnowledgeNamespaces: (domainId: string) => readonly string[];
}

export interface DomainAwareSessionEvent extends SessionEvent {
  readonly domainId: string | null;
  readonly knowledgeNamespaces: readonly string[];
}

export class DomainKnowledgeIntegrationService {
  public constructor(private readonly options: DomainKnowledgeIntegrationServiceOptions) {}

  public replaySessionEvents(sessionId: string): DomainAwareSessionEvent[] {
    return this.annotate(this.options.sessionStorage.replaySessionEvents(sessionId));
  }

  public replayTaskSessionHistory(taskId: string): DomainAwareSessionEvent[] {
    return this.annotate(this.options.sessionStorage.replayTaskSessionHistory(taskId));
  }

  private annotate(events: readonly SessionEvent[]): DomainAwareSessionEvent[] {
    return events.map((event) => {
      const payloadDomainId = typeof event.payload.domainId === "string" && event.payload.domainId.trim().length > 0
        ? event.payload.domainId.trim()
        : null;
      const domainId = payloadDomainId ?? this.options.resolveDomainIdByTaskId(event.taskId);
      return {
        ...event,
        domainId,
        knowledgeNamespaces: domainId == null ? [] : [...this.options.listKnowledgeNamespaces(domainId)],
      };
    });
  }
}
