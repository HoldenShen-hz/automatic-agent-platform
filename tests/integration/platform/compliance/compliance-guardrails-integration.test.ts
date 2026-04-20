import assert from "node:assert/strict";
import test from "node:test";

import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { FieldEncryptionService } from "../../../../src/platform/compliance/encryption/index.js";
import { DataLineageService } from "../../../../src/platform/compliance/lineage/index.js";
import { ErasurePlanningService } from "../../../../src/platform/compliance/erasure/index.js";
import { DataResidencyPolicyService } from "../../../../src/platform/compliance/data-residency/index.js";

test("integration: classification, encryption, residency, lineage, and erasure produce a consistent compliance chain", () => {
  const classification = new DataClassificationService({ strictMode: true });
  const encryption = new FieldEncryptionService();
  const lineage = new DataLineageService();
  const erasure = new ErasurePlanningService();
  const residency = new DataResidencyPolicyService();

  const classificationResult = classification.classify("Customer email alice@example.com with secret key", { source: "prompt" });
  const encrypted = encryption.protectRecord({
    record: { payload: { email: "alice@example.com" } },
    rules: [{ fieldPath: "payload.email", classification: "restricted" }],
    keyRef: "kms://tenant-a/key-1",
  });
  const residencyResult = residency.decideTransfer({
    policy: {
      tenantId: "tenant-a",
      allowedRegions: ["cn-shanghai", "cn-beijing"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "cn-shanghai",
    targetRegion: "cn-beijing",
    classification: classificationResult.level,
  });
  const lineageEdge = lineage.recordEdge({
    sourceRef: "prompt_input:1",
    targetRef: "artifact:redacted-1",
    kind: "redacted_from",
    actorRef: "system:compliance",
    metadata: { classification: classificationResult.level },
  });
  const erasurePlan = erasure.createPlan({
    subjectRef: "user:alice",
    requestedBy: "privacy@example.com",
    slaHours: 12,
    targets: [
      { targetRef: lineageEdge.targetRef, targetKind: "artifact", containsPii: true },
    ],
  });

  assert.equal(classificationResult.level, "restricted");
  assert.equal(typeof (encrypted.protectedRecord.payload as Record<string, unknown>).email, "string");
  assert.equal(residencyResult.decision, "require_redaction");
  assert.equal(erasurePlan.status, "ready");
  assert.equal(lineage.traceFrom("prompt_input:1").length, 1);
});
