import assert from "node:assert/strict";
import test from "node:test";

import { DomainPromptGovernanceService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/dist/src/domains/prompt-library/domain-prompt-governance-service.js";
import type { DomainPromptLibrary } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/dist/src/domains/prompt-library/index.js";

// Helper to build a minimal prompt library for testing
function makeLibrary(domainId: string, prompts?: Array<{ id: string; version: string; guardrails?: string[]; stage?: string }>): DomainPromptLibrary {
  return {
    libraryId: `${domainId}_library`,
    domainId,
    prompts: (prompts ?? [
      { id: "prompt_a", version: "1.0.0", guardrails: [], stage: "release" },
    ]).map((p) => ({
      promptId: p.id,
      version: p.version,
      template: `Template for ${p.id}`,
      stage: (p.stage as DomainPromptLibrary["prompts"][0]["stage"]) ?? "release",
      guardrails: p.guardrails ?? [],
    })),
  };
}

// Helper to create a library with guardrails requiring approval
function guardedLibrary(domainId: string, guardrails: string[] = ["approval_required"]): DomainPromptLibrary {
  return {
    libraryId: `${domainId}_lib`,
    domainId,
    prompts: [
      {
        promptId: "guarded_prompt",
        version: "1.0.0",
        template: "Guarded template",
        stage: "release",
        guardrails,
      },
    ],
  };
}

test("review returns summary for existing prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "prompt_x", version: "2.0.0", guardrails: ["auth_required"], stage: "execute" }]);
  const summary = service.review(library, "prompt_x");
  assert.equal(summary.promptId, "prompt_x");
  assert.equal(summary.version, "2.0.0");
  assert.equal(summary.domainId, "test");
  assert.equal(summary.reviewRequired, true);
  assert.ok(summary.cacheSegments.includes("fixed_prefix"));
});

test("review throws for nonexistent prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test");
  assert.throws(() => {
    service.review(library, "nonexistent");
  }, /prompt_not_found/);
});

test("proposeRelease requires lint evidence", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "prompt_lint", version: "1.0.0" }]);
  assert.throws(() => {
    service.proposeRelease(library, {
      promptId: "prompt_lint",
      owner: "admin",
      rolloutScope: ["tenant:alpha"],
      rolloutMode: "suggest",
      lintEvidence: [],
      evalEvidence: ["eval:pass"],
    });
  }, /lint_evidence_required/);
});

test("proposeRelease requires eval evidence", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "prompt_eval", version: "1.0.0" }]);
  assert.throws(() => {
    service.proposeRelease(library, {
      promptId: "prompt_eval",
      owner: "admin",
      rolloutScope: ["tenant:alpha"],
      rolloutMode: "suggest",
      lintEvidence: ["lint:pass"],
      evalEvidence: [],
    });
  }, /eval_evidence_required/);
});

test("proposeRelease requires approval ticket for guarded prompts", () => {
  const service = new DomainPromptGovernanceService();
  const library = guardedLibrary("guarded");
  assert.throws(() => {
    service.proposeRelease(library, {
      promptId: "guarded_prompt",
      owner: "eng_lead",
      rolloutScope: ["domain:guarded"],
      rolloutMode: "suggest",
      lintEvidence: ["lint:pass"],
      evalEvidence: ["eval:pass"],
    });
  }, /approval_ticket_required/);
});

test("proposeRelease creates record with approved status", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "release_ok", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "release_ok",
    owner: "eng_lead",
    rolloutScope: ["tenant:alpha"],
    rolloutMode: "suggest",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
  });
  assert.equal(record.status, "approved");
  assert.equal(record.owner, "eng_lead");
  assert.equal(record.promptId, "release_ok");
  assert.ok(record.releaseId.length > 0);
});

test("proposeRelease stores rollback version when provided", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "rb_test", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "rb_test",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    rollbackVersion: "0.9.0",
  });
  assert.equal(record.rollbackVersion, "0.9.0");
});

test("activate changes status to active and records timestamp", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "activate_me", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "activate_me",
    owner: "admin",
    rolloutScope: ["tenant:alpha"],
    rolloutMode: "suggest",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-100",
  });
  const activated = service.activate(record.releaseId);
  assert.equal(activated.status, "active");
  assert.notEqual(activated.activatedAt, null);
});

test("activate throws for non-approved release", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "reject_me", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "reject_me",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "off", // rejected by rollout mode
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-101",
  });
  // Record is created but activation should fail
  assert.throws(() => {
    service.activate(record.releaseId);
  }, /release_not_approved|rollout_mode_inactive/);
});

test("activate throws for release with rolloutMode off", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "inactive_rollout", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "inactive_rollout",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "off",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-102",
  });
  assert.throws(() => {
    service.activate(record.releaseId);
  }, /rollout_mode_inactive/);
});

test("getActiveRelease returns null for never-activated prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "never_active", version: "1.0.0" }]);
  service.proposeRelease(library, {
    promptId: "never_active",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "suggest",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
  });
  assert.equal(service.getActiveRelease("never_active"), null);
});

test("getActiveRelease returns the active release record", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "active_prompt", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "active_prompt",
    owner: "admin",
    rolloutScope: ["tenant:alpha"],
    rolloutMode: "suggest",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-200",
  });
  service.activate(record.releaseId);
  const active = service.getActiveRelease("active_prompt");
  assert.notEqual(active, null);
  assert.equal(active!.releaseId, record.releaseId);
  assert.equal(active!.status, "active");
});

test("rollback marks release as rolled_back", () => {
  const service = new DomainPromptGovernanceService();
  const library = guardedLibrary("rb_test");
  // Add the rollback target version to the library
  library.prompts.push({
    promptId: "guarded_prompt",
    version: "0.9.0",
    template: "Old guarded template",
    stage: "release",
    guardrails: ["approval_required"],
  });
  const record = service.proposeRelease(library, {
    promptId: "guarded_prompt",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-300",
    rollbackVersion: "0.9.0",
  });
  const rolled = service.rollback(library, record.releaseId);
  assert.equal(rolled.status, "rolled_back");
});

test("rollback clears active release mapping", () => {
  const service = new DomainPromptGovernanceService();
  const library = guardedLibrary("clear_test");
  // Add the rollback target version to the library
  library.prompts.push({
    promptId: "guarded_prompt",
    version: "0.9.0",
    template: "Old guarded template",
    stage: "release",
    guardrails: ["approval_required"],
  });
  const record = service.proposeRelease(library, {
    promptId: "guarded_prompt",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-400",
    rollbackVersion: "0.9.0",
  });
  service.activate(record.releaseId);
  assert.notEqual(service.getActiveRelease("guarded_prompt"), null);
  service.rollback(library, record.releaseId);
  assert.equal(service.getActiveRelease("guarded_prompt"), null);
});

test("rollback throws when target version not in library", () => {
  const service = new DomainPromptGovernanceService();
  const library = guardedLibrary("missing_target");
  const record = service.proposeRelease(library, {
    promptId: "guarded_prompt",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-500",
    rollbackVersion: "99.0.0", // not in library
  });
  assert.throws(() => {
    service.rollback(library, record.releaseId);
  }, /rollback_target_missing/);
});

test("rollback requires rollback version when not stored", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("no_rb", [{ id: "no_version", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "no_version",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
  });
  // rollbackVersion is null
  assert.throws(() => {
    service.rollback(library, record.releaseId);
  }, /rollback_version_required/);
});

test("rollback accepts explicit version override", () => {
  const service = new DomainPromptGovernanceService();
  const library = guardedLibrary("override_test");
  // Add version 0.8.0 to library
  library.prompts.push({
    promptId: "guarded_prompt",
    version: "0.8.0",
    template: "Old template",
    stage: "release",
    guardrails: ["approval_required"],
  });
  const record = service.proposeRelease(library, {
    promptId: "guarded_prompt",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-600",
    rollbackVersion: "0.9.0",
  });
  const rolled = service.rollback(library, record.releaseId, "0.8.0");
  assert.equal(rolled.status, "rolled_back");
});

test("getRelease returns stored release record", () => {
  const service = new DomainPromptGovernanceService();
  const library = makeLibrary("test", [{ id: "get_test", version: "1.0.0" }]);
  const record = service.proposeRelease(library, {
    promptId: "get_test",
    owner: "admin",
    rolloutScope: [],
    rolloutMode: "suggest",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
  });
  const retrieved = service.getRelease(record.releaseId);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.releaseId, record.releaseId);
});

test("getRelease returns null for unknown release", () => {
  const service = new DomainPromptGovernanceService();
  assert.equal(service.getRelease("unknown_release_id"), null);
});