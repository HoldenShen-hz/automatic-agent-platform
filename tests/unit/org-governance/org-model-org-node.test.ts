import assert from "node:assert/strict";
import test from "node:test";
import {
  OrgNodeSchema,
  OrgNodeTypeSchema,
  LegalEntityBoundarySchema,
  type OrgNode,
} from "../../../src/org-governance/org-model/org-node/index.js";

test("OrgNodeSchema parses valid org node", () => {
  const node = OrgNodeSchema.parse({
    nodeId: "org_1",
    type: "tenant",
    name: "Acme Corp",
    parentNodeId: null,
    ownerUserIds: ["user_1"],
  });

  assert.strictEqual(node.orgNodeId, "org_1");
  assert.strictEqual(node.nodeType, "tenant");
  assert.strictEqual(node.displayName, "Acme Corp");
});

test("OrgNodeSchema accepts legacy field names", () => {
  const node = OrgNodeSchema.parse({
    orgNodeId: "legacy_1",
    nodeType: "division",
    displayName: "Legacy Division",
    parentOrgNodeId: null,
    ownerUserIds: [],
  });

  assert.strictEqual(node.orgNodeId, "legacy_1");
  assert.strictEqual(node.nodeType, "division");
});

test("OrgNodeSchema rejects missing nodeId and orgNodeId", () => {
  assert.throws(() => {
    OrgNodeSchema.parse({
      type: "tenant",
      name: "Test",
    });
  }, /nodeId or orgNodeId is required/);
});

test("OrgNodeSchema rejects deprecated company node type before required nodeId check", () => {
  assert.throws(() => {
    OrgNodeSchema.parse({
      type: "company",
      name: "Test",
    });
  });
});

test("OrgNodeSchema rejects missing type", () => {
  assert.throws(() => {
    OrgNodeSchema.parse({
      nodeId: "org_1",
      name: "Test",
    });
  }, /type or nodeType is required/);
});

test("OrgNodeTypeSchema validates enum values", () => {
  assert.strictEqual(OrgNodeTypeSchema.parse("tenant"), "tenant");
  assert.strictEqual(OrgNodeTypeSchema.parse("division"), "division");
  assert.strictEqual(OrgNodeTypeSchema.parse("department"), "department");
  assert.strictEqual(OrgNodeTypeSchema.parse("team"), "team");
  assert.strictEqual(OrgNodeTypeSchema.parse("seat"), "seat");
});

test("OrgNodeTypeSchema rejects invalid values", () => {
  assert.throws(() => {
    OrgNodeTypeSchema.parse("invalid");
  });
});

test("LegalEntityBoundarySchema parses valid boundary", () => {
  const boundary = LegalEntityBoundarySchema.parse({
    boundaryId: "bound_1",
    legalEntityId: "entity_1",
    jurisdictionCountry: "US",
    dataResidencyRegion: "us-west-2",
    crossBorderTransferPolicy: "approval_required",
  });

  assert.strictEqual(boundary.boundaryId, "bound_1");
  assert.strictEqual(boundary.crossBorderTransferPolicy, "approval_required");
  assert.deepStrictEqual(boundary.restrictedDataClasses, []);
});

test("LegalEntityBoundarySchema applies defaults", () => {
  const boundary = LegalEntityBoundarySchema.parse({
    boundaryId: "bound_1",
    legalEntityId: "entity_1",
    jurisdictionCountry: "US",
    dataResidencyRegion: "us-west-2",
  });

  assert.strictEqual(boundary.crossBorderTransferPolicy, "approval_required");
  assert.deepStrictEqual(boundary.crossEntityApprovalRoles, ["legal_reviewer", "compliance_officer"]);
});
