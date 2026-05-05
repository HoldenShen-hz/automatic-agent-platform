/**
 * Unit tests for DomainPromptGovernanceService
 *
 * Tests the prompt release governance lifecycle including
 * review, propose, activate, rollback operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainPromptGovernanceService,
  type PromptReleaseDraft,
} from "../../../../src/domains/prompt-library/domain-prompt-governance-service.js";
import {
  DomainPromptLibrarySchema,
  type DomainPromptLibrary,
} from "../../../../src/domains/prompt-library/index.js";

function createTestLibrary(): DomainPromptLibrary {
  return DomainPromptLibrarySchema.parse({
    libraryId: "lib_coding",
    domainId: "coding",
    prompts: [
      {
        promptId: "prompt_plan",
        stage: "plan",
        version: "1.0",
        template: "Plan the task",
        guardrails: ["cite_sources"],
      },
      {
        promptId: "prompt_execute",
        stage: "execute",
        version: "1.0",
        template: "Execute the plan",
        guardrails: [],
      },
      {
        promptId: "prompt_v2",
        stage: "execute",
        version: "2.0",
        template: "Execute with improvements",
        guardrails: [],
      },
    ],
  });
}

function createTestDraft(overrides: Partial<PromptReleaseDraft> = {}): PromptReleaseDraft {
  return {
    promptId: "prompt_plan",
    owner: "user_1",
    rolloutScope: ["team_1", "team_2"],
    rolloutMode: "suggest",
    lintEvidence: ["lint_passed"],
    evalEvidence: ["eval_score_0.95"],
    ...overrides,
  };
}

// --- review tests ---

test("review returns prompt details for existing prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();

  const result = service.review(library, "prompt_plan");

  assert.equal(result.promptId, "prompt_plan");
  assert.equal(result.domainId, "coding");
  assert.equal(result.version, "1.0");
  assert.equal(result.stage, "plan");
  assert.ok(result.guardrails.includes("cite_sources"));
  assert.equal(result.reviewRequired, true);
});

test("review returns reviewRequired false when guardrails are empty", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();

  const result = service.review(library, "prompt_execute");

  assert.equal(result.reviewRequired, false);
});

test("review throws when prompt not found", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();

  assert.throws(
    () => service.review(library, "nonexistent"),
    /prompt_governance\.prompt_not_found:nonexistent/,
  );
});

// --- proposeRelease tests ---

test("proposeRelease creates approved release when all conditions met", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" }); // No guardrails, no approval needed

  const result = service.proposeRelease(library, draft);

  assert.ok(result.releaseId.startsWith("prompt_release_"));
  assert.equal(result.promptId, "prompt_execute");
  assert.equal(result.domainId, "coding");
  assert.equal(result.owner, "user_1");
  assert.equal(result.status, "approved");
  assert.equal(result.activatedAt, null);
});

test("proposeRelease throws when lint evidence is empty", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ lintEvidence: [] });

  assert.throws(
    () => service.proposeRelease(library, draft),
    /prompt_governance\.lint_evidence_required/,
  );
});

test("proposeRelease throws when eval evidence is empty", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ evalEvidence: [] });

  assert.throws(
    () => service.proposeRelease(library, draft),
    /prompt_governance\.eval_evidence_required/,
  );
});

test("proposeRelease throws when approval ticket required but missing", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  // prompt_plan has guardrails, so approval is required
  const draft = createTestDraft({ approvalTicketId: undefined });

  assert.throws(
    () => service.proposeRelease(library, draft),
    /prompt_governance\.approval_ticket_required/,
  );
});

test("proposeRelease accepts approval ticket when guardrails exist", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ approvalTicketId: "TICKET-123" });

  const result = service.proposeRelease(library, draft);

  assert.equal(result.status, "approved");
  assert.equal(result.approvalTicketId, "TICKET-123");
});

test("proposeRelease stores release record", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });

  const result = service.proposeRelease(library, draft);

  const stored = service.getRelease(result.releaseId);
  assert.ok(stored);
  assert.equal(stored!.releaseId, result.releaseId);
});

// --- activate tests ---

test("activate sets status to active and records timestamp", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);

  const activated = service.activate(release.releaseId);

  assert.equal(activated.status, "active");
  assert.ok(activated.activatedAt !== null);
});

test("activate sets active release for prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);

  service.activate(release.releaseId);

  const active = service.getActiveRelease("prompt_execute");
  assert.ok(active);
  assert.equal(active!.releaseId, release.releaseId);
});

test("activate throws when release not found", () => {
  const service = new DomainPromptGovernanceService();

  assert.throws(
    () => service.activate("nonexistent"),
    /prompt_governance\.release_not_found:nonexistent/,
  );
});

test("activate throws when release not approved", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);

  // Manually set to non-approved status isn't possible through public API
  // But we can test with a mock by trying to activate twice
  service.activate(release.releaseId);

  assert.throws(
    () => service.activate(release.releaseId),
    /prompt_governance\.release_not_approved/,
  );
});

test("activate throws when rollout mode is off", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute", rolloutMode: "off" });
  const release = service.proposeRelease(library, draft);

  assert.throws(
    () => service.activate(release.releaseId),
    /prompt_governance\.rollout_mode_inactive/,
  );
});

// --- rollback tests ---

test("rollback sets status to rolled_back", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);
  service.activate(release.releaseId);

  const rolledBack = service.rollback(library, release.releaseId, "1.0");

  assert.equal(rolledBack.status, "rolled_back");
});

test("rollback clears active release for prompt", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);
  service.activate(release.releaseId);

  service.rollback(library, release.releaseId, "1.0");

  const active = service.getActiveRelease("prompt_execute");
  assert.equal(active, null);
});

test("rollback uses rollbackVersion from draft when not specified", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute", rollbackVersion: "1.0" });
  const release = service.proposeRelease(library, draft);

  const rolledBack = service.rollback(library, release.releaseId);

  // Should use "1.0" from draft
  assert.equal(rolledBack.status, "rolled_back");
});

test("rollback throws when rollback version not specified and not in draft", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute", rollbackVersion: undefined });
  const release = service.proposeRelease(library, draft);

  assert.throws(
    () => service.rollback(library, release.releaseId),
    /prompt_governance\.rollback_version_required/,
  );
});

test("rollback throws when rollback target version not in library", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();
  const draft = createTestDraft({ promptId: "prompt_execute" });
  const release = service.proposeRelease(library, draft);

  assert.throws(
    () => service.rollback(library, release.releaseId, "nonexistent_version"),
    /prompt_governance\.rollback_target_missing:nonexistent_version/,
  );
});

test("rollback throws when release not found", () => {
  const service = new DomainPromptGovernanceService();
  const library = createTestLibrary();

  assert.throws(
    () => service.rollback(library, "nonexistent", "1.0"),
    /prompt_governance\.release_not_found:nonexistent/,
  );
});

// --- getRelease tests ---

test("getRelease returns null for nonexistent release", () => {
  const service = new DomainPromptGovernanceService();

  const result = service.getRelease("nonexistent");

  assert.equal(result, null);
});

// --- getActiveRelease tests ---

test("getActiveRelease returns null when no active release", () => {
  const service = new DomainPromptGovernanceService();

  const result = service.getActiveRelease("prompt_plan");

  assert.equal(result, null);
});

test("getActiveRelease returns null for unknown prompt", () => {
  const service = new DomainPromptGovernanceService();

  const result = service.getActiveRelease("nonexistent");

  assert.equal(result, null);
});
