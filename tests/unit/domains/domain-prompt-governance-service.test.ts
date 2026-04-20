import assert from "node:assert/strict";
import test from "node:test";

import type { DomainPromptLibrary } from "../../../src/domains/prompt-library/index.js";
import { DomainPromptGovernanceService } from "../../../src/domains/prompt-library/domain-prompt-governance-service.js";

const LIBRARY: DomainPromptLibrary = {
  libraryId: "prompt_coding",
  domainId: "coding",
  prompts: [
    {
      promptId: "release_prompt",
      stage: "release",
      version: "1.0.0",
      template: "Release safely",
      guardrails: ["approval_required"],
    },
    {
      promptId: "release_prompt",
      stage: "release",
      version: "0.9.0",
      template: "Release safely legacy",
      guardrails: ["approval_required"],
    },
  ],
};

test("DomainPromptGovernanceService requires approval ticket for guarded prompts", () => {
  const service = new DomainPromptGovernanceService();
  assert.throws(() => {
    service.proposeRelease(LIBRARY, {
      promptId: "release_prompt",
      owner: "eng_lead",
      rolloutScope: ["domain:coding"],
      rolloutMode: "suggest",
      lintEvidence: ["lint:pass"],
      evalEvidence: ["eval:pass"],
    });
  }, /prompt_governance\.approval_ticket_required/);
});

test("DomainPromptGovernanceService activates approved releases and supports rollback", () => {
  const service = new DomainPromptGovernanceService();
  const release = service.proposeRelease(LIBRARY, {
    promptId: "release_prompt",
    owner: "eng_lead",
    rolloutScope: ["tenant:alpha"],
    rolloutMode: "shadow",
    lintEvidence: ["lint:pass"],
    evalEvidence: ["eval:pass"],
    approvalTicketId: "CHG-100",
    rollbackVersion: "0.9.0",
  });

  const active = service.activate(release.releaseId);
  assert.equal(active.status, "active");
  assert.equal(service.getActiveRelease("release_prompt")?.releaseId, release.releaseId);

  const rolledBack = service.rollback(LIBRARY, release.releaseId);
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(service.getActiveRelease("release_prompt"), null);
});
