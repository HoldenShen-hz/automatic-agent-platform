import assert from "node:assert/strict";
import test from "node:test";

import { DomainKnowledgeIntegrationService } from "../../../../src/domains/registry/domain-knowledge-integration-service.js";
import type { SessionDualStorageService } from "../../../../src/platform/five-plane-state-evidence/truth/session-dual-storage.js";

test("DomainKnowledgeIntegrationService annotates replayed events with domain and knowledge namespaces", () => {
  const sessionStorage: Pick<SessionDualStorageService, "replaySessionEvents" | "replayTaskSessionHistory"> = {
    replaySessionEvents: () => [{
      eventType: "session_created",
      sessionId: "session-1",
      taskId: "task-1",
      timestamp: "2026-05-25T00:00:00.000Z",
      payload: {},
    }],
    replayTaskSessionHistory: () => [{
      eventType: "session_completed",
      sessionId: "session-1",
      taskId: "task-1",
      timestamp: "2026-05-25T00:01:00.000Z",
      payload: { domainId: "coding" },
    }],
  };
  const service = new DomainKnowledgeIntegrationService({
    sessionStorage: sessionStorage as SessionDualStorageService,
    resolveDomainIdByTaskId: (taskId) => taskId === "task-1" ? "coding" : null,
    listKnowledgeNamespaces: (domainId) => domainId === "coding" ? ["repo", "runbook"] : [],
  });

  const replayed = service.replaySessionEvents("session-1");
  const taskHistory = service.replayTaskSessionHistory("task-1");

  assert.equal(replayed[0]?.domainId, "coding");
  assert.deepEqual(replayed[0]?.knowledgeNamespaces, ["repo", "runbook"]);
  assert.equal(taskHistory[0]?.domainId, "coding");
  assert.deepEqual(taskHistory[0]?.knowledgeNamespaces, ["repo", "runbook"]);
});
