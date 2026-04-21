/**
 * Unit tests for OrgModel Service - OrgNode and Reporting Chain
 *
 * @see src/org-governance/org-model/org-node/index.ts
 * @see src/org-governance/org-model/hierarchy/index.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrgNodeTypeSchema, OrgNodeSchema, isLeafOrgNode, getPlatformMapping, validateHierarchyDepth, createCrossOrgCollaborator, } from "../../../../src/org-governance/org-model/org-node/index.js";
import { validateOrgHierarchy, listAncestorNodeIds, listDescendantNodeIds, findRootNode, getNodesAtLevel, getNodeDepth, findLowestCommonAncestor, buildReportingChain, detectOrgChangeEvents, } from "../../../../src/org-governance/org-model/hierarchy/index.js";
// Helper to create org nodes with sensible defaults
function createOrgNode(overrides = {}) {
    return {
        orgNodeId: overrides.orgNodeId ?? "node-1",
        nodeType: overrides.nodeType ?? "department",
        displayName: overrides.displayName ?? "Test Node",
        parentOrgNodeId: overrides.parentOrgNodeId ?? null,
        ownerUserIds: overrides.ownerUserIds ?? [],
        active: overrides.active ?? true,
        costCenter: overrides.costCenter ?? "",
        metadata: overrides.metadata ?? {},
    };
}
describe("OrgModelService - OrgNode Types and Schema", () => {
    describe("OrgNodeTypeSchema", () => {
        it("should accept all valid org node types", () => {
            const validTypes = ["company", "division", "department", "team", "member"];
            for (const type of validTypes) {
                const result = OrgNodeTypeSchema.safeParse(type);
                assert.strictEqual(result.success, true, `Type ${type} should be valid`);
            }
        });
        it("should reject invalid org node types", () => {
            const result = OrgNodeTypeSchema.safeParse("invalid_type");
            assert.strictEqual(result.success, false);
        });
        it("should reject empty string", () => {
            const result = OrgNodeTypeSchema.safeParse("");
            assert.strictEqual(result.success, false);
        });
    });
    describe("OrgNodeSchema", () => {
        it("should parse a valid org node with all fields", () => {
            const node = {
                orgNodeId: "company-1",
                nodeType: "company",
                displayName: "Acme Corp",
                parentOrgNodeId: null,
                ownerUserIds: ["ceo-1"],
                active: true,
                costCenter: "CC-001",
                metadata: { region: "US" },
            };
            const result = OrgNodeSchema.safeParse(node);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data.orgNodeId, "company-1");
                assert.strictEqual(result.data.nodeType, "company");
                assert.strictEqual(result.data.displayName, "Acme Corp");
                assert.strictEqual(result.data.parentOrgNodeId, null);
                assert.deepStrictEqual(result.data.ownerUserIds, ["ceo-1"]);
                assert.strictEqual(result.data.active, true);
                assert.strictEqual(result.data.costCenter, "CC-001");
                assert.deepStrictEqual(result.data.metadata, { region: "US" });
            }
        });
        it("should apply default values for optional fields", () => {
            const minimal = {
                orgNodeId: "dept-1",
                nodeType: "department",
                displayName: "Engineering",
                parentOrgNodeId: "div-1",
            };
            const result = OrgNodeSchema.safeParse(minimal);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.deepStrictEqual(result.data.ownerUserIds, []);
                assert.strictEqual(result.data.active, true);
                assert.strictEqual(result.data.costCenter, "");
                assert.deepStrictEqual(result.data.metadata, {});
            }
        });
        it("should reject empty orgNodeId", () => {
            const result = OrgNodeSchema.safeParse({
                orgNodeId: "",
                nodeType: "team",
                displayName: "Test",
            });
            assert.strictEqual(result.success, false);
        });
        it("should reject empty displayName", () => {
            const result = OrgNodeSchema.safeParse({
                orgNodeId: "node-1",
                nodeType: "team",
                displayName: "",
            });
            assert.strictEqual(result.success, false);
        });
        it("should accept nullable parentOrgNodeId", () => {
            const result = OrgNodeSchema.safeParse({
                orgNodeId: "company-1",
                nodeType: "company",
                displayName: "Root",
                parentOrgNodeId: null,
            });
            assert.strictEqual(result.success, true);
        });
        it("should accept string parentOrgNodeId", () => {
            const result = OrgNodeSchema.safeParse({
                orgNodeId: "dept-1",
                nodeType: "department",
                displayName: "Engineering",
                parentOrgNodeId: "div-1",
            });
            assert.strictEqual(result.success, true);
        });
        it("should reject invalid nodeType", () => {
            const result = OrgNodeSchema.safeParse({
                orgNodeId: "node-1",
                nodeType: "invalid",
                displayName: "Test",
            });
            assert.strictEqual(result.success, false);
        });
    });
    describe("isLeafOrgNode", () => {
        it("should return true for member nodes", () => {
            const memberNode = createOrgNode({
                orgNodeId: "member-1",
                nodeType: "member",
                displayName: "John Doe",
                parentOrgNodeId: "team-1",
                ownerUserIds: ["user-1"],
            });
            assert.strictEqual(isLeafOrgNode(memberNode), true);
        });
        it("should return false for company nodes", () => {
            const companyNode = createOrgNode({
                orgNodeId: "company-1",
                nodeType: "company",
                displayName: "Acme Corp",
                parentOrgNodeId: null,
            });
            assert.strictEqual(isLeafOrgNode(companyNode), false);
        });
        it("should return false for division nodes", () => {
            const divisionNode = createOrgNode({
                orgNodeId: "division-1",
                nodeType: "division",
                displayName: "Engineering",
                parentOrgNodeId: "company-1",
            });
            assert.strictEqual(isLeafOrgNode(divisionNode), false);
        });
        it("should return false for department nodes", () => {
            const departmentNode = createOrgNode({
                orgNodeId: "dept-1",
                nodeType: "department",
                displayName: "Platform",
                parentOrgNodeId: "division-1",
            });
            assert.strictEqual(isLeafOrgNode(departmentNode), false);
        });
        it("should return false for team nodes", () => {
            const teamNode = createOrgNode({
                orgNodeId: "team-1",
                nodeType: "team",
                displayName: "Backend Team",
                parentOrgNodeId: "dept-1",
            });
            assert.strictEqual(isLeafOrgNode(teamNode), false);
        });
    });
    describe("getPlatformMapping", () => {
        it("should map company to platform", () => {
            assert.strictEqual(getPlatformMapping("company"), "platform");
        });
        it("should map division to tenant_group", () => {
            assert.strictEqual(getPlatformMapping("division"), "tenant_group");
        });
        it("should map department to tenant", () => {
            assert.strictEqual(getPlatformMapping("department"), "tenant");
        });
        it("should map team to domain/pack_group", () => {
            assert.strictEqual(getPlatformMapping("team"), "domain/pack_group");
        });
        it("should map member to principal", () => {
            assert.strictEqual(getPlatformMapping("member"), "principal");
        });
    });
    describe("createCrossOrgCollaborator", () => {
        it("should create collaborator with generated ID", () => {
            const collaborator = createCrossOrgCollaborator({
                userId: "user-guest-1",
                homeOrgNodeId: "partner-company",
                targetOrgNodeId: "dept-eng",
                role: "guest",
                scope: {
                    targetOrgNodeId: "dept-eng",
                    allowedDomains: ["code-review", "documentation"],
                    allowedActions: ["view", "execute"],
                    expiresAt: "2026-12-31T23:59:59Z",
                },
                grantedBy: "org-admin-1",
            });
            assert.ok(collaborator.collaboratorId.startsWith("collab:user-guest-1:"));
            assert.strictEqual(collaborator.active, true);
            assert.ok(collaborator.grantedAt);
        });
        it("should create collaborator with all roles", () => {
            const roles = [
                "guest",
                "consultant",
                "contractor",
                "partner",
            ];
            for (const role of roles) {
                const collaborator = createCrossOrgCollaborator({
                    userId: `user-${role}`,
                    homeOrgNodeId: "partner",
                    targetOrgNodeId: "dept-eng",
                    role,
                    scope: {
                        targetOrgNodeId: "dept-eng",
                        allowedDomains: ["code-review"],
                        allowedActions: ["view"],
                        expiresAt: null,
                    },
                    grantedBy: "admin",
                });
                assert.strictEqual(collaborator.role, role);
            }
        });
    });
});
describe("OrgModelService - Reporting Chain", () => {
    describe("buildReportingChain", () => {
        it("should build reporting chain for employee", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: ["vp"], parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", ownerUserIds: ["manager"], parentOrgNodeId: "dept" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "team" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "member");
            assert.deepStrictEqual(chain, ["manager", "director", "vp"]);
        });
        it("should build reporting chain stopping at node with no owners", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: [], parentOrgNodeId: "company" }), // no owner
                createOrgNode({ orgNodeId: "dept", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "dept" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "member");
            // Should only include director, not vp (no owner at division level)
            assert.deepStrictEqual(chain, ["director"]);
        });
        it("should build reporting chain for top-level employee", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "company" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "member");
            assert.deepStrictEqual(chain, ["ceo"]);
        });
        it("should return empty chain when node has no parent", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
            ];
            const chain = buildReportingChain(nodes, "ceo", "company");
            assert.deepStrictEqual(chain, []);
        });
        it("should return empty chain when node not found", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
            ];
            const chain = buildReportingChain(nodes, "unknown", "nonexistent");
            assert.deepStrictEqual(chain, []);
        });
        it("should use first owner when node has multiple owners", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", ownerUserIds: ["vp1", "vp2"], parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "division" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "member");
            // Should use first owner (vp1)
            assert.deepStrictEqual(chain, ["vp1"]);
        });
        it("should handle deep hierarchy with 5 levels", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", ownerUserIds: ["vp"], parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "t1", nodeType: "team", ownerUserIds: ["manager"], parentOrgNodeId: "dept1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "t1" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "m1");
            assert.deepStrictEqual(chain, ["manager", "director", "vp"]);
        });
        it("should skip nodes with empty ownerUserIds array", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", ownerUserIds: ["ceo"], parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", ownerUserIds: [], parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", ownerUserIds: ["director"], parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", ownerUserIds: ["employee"], parentOrgNodeId: "dept1" }),
            ];
            const chain = buildReportingChain(nodes, "employee", "m1");
            // Should skip division (no owners) and go directly to director
            assert.deepStrictEqual(chain, ["director"]);
        });
    });
});
describe("OrgModelService - Hierarchy Validation", () => {
    describe("validateOrgHierarchy", () => {
        it("should pass for valid flat hierarchy", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "division" }),
            ];
            const findings = validateOrgHierarchy(nodes);
            assert.strictEqual(findings.length, 0);
        });
        it("should pass for valid 5-level hierarchy", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
            ];
            const findings = validateOrgHierarchy(nodes);
            assert.strictEqual(findings.length, 0);
        });
        it("should detect missing parent reference", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "nonexistent" }),
            ];
            const findings = validateOrgHierarchy(nodes);
            assert.ok(findings.some((f) => f.includes("org_hierarchy.missing_parent")));
        });
        it("should detect self-cycle", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: "company" }),
            ];
            const findings = validateOrgHierarchy(nodes);
            assert.ok(findings.some((f) => f.includes("org_hierarchy.self_cycle")));
        });
        it("should detect hierarchy exceeding max depth", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
                createOrgNode({ orgNodeId: "p1", nodeType: "member", parentOrgNodeId: "m1" }), // 6th level - exceeds 5
            ];
            const findings = validateOrgHierarchy(nodes);
            assert.ok(findings.some((f) => f.includes("org_hierarchy.exceeds_max_depth")));
        });
        it("should return empty for empty nodes array", () => {
            const findings = validateOrgHierarchy([]);
            assert.strictEqual(findings.length, 0);
        });
    });
    describe("validateHierarchyDepth", () => {
        it("should return valid for empty nodes", () => {
            const result = validateHierarchyDepth([]);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.depth, 0);
        });
        it("should return invalid when no root node exists", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "nonexistent" }),
            ];
            const result = validateHierarchyDepth(nodes);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.depth, 0);
        });
        it("should return valid for single root node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const result = validateHierarchyDepth(nodes);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.depth, 1);
        });
        it("should calculate correct depth for flat hierarchy", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "company" }),
            ];
            const result = validateHierarchyDepth(nodes);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.depth, 2);
        });
        it("should calculate correct depth for full 5-level hierarchy", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
            ];
            const result = validateHierarchyDepth(nodes);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.depth, 5);
        });
        it("should return invalid for 6-level hierarchy", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "c1", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "d1", nodeType: "division", parentOrgNodeId: "c1" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "d1" }),
                createOrgNode({ orgNodeId: "t1", nodeType: "team", parentOrgNodeId: "dept1" }),
                createOrgNode({ orgNodeId: "m1", nodeType: "member", parentOrgNodeId: "t1" }),
                createOrgNode({ orgNodeId: "p1", nodeType: "member", parentOrgNodeId: "m1" }),
            ];
            const result = validateHierarchyDepth(nodes);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.depth, 6);
        });
    });
});
describe("OrgModelService - Hierarchy Traversal", () => {
    describe("listAncestorNodeIds", () => {
        it("should return ancestors in correct order (bottom to top)", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "department", nodeType: "department", parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "department" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
            ];
            const ancestors = listAncestorNodeIds(nodes, "member");
            assert.deepStrictEqual(ancestors, ["team", "department", "division", "company"]);
        });
        it("should return empty array for root node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const ancestors = listAncestorNodeIds(nodes, "company");
            assert.deepStrictEqual(ancestors, []);
        });
        it("should return empty array for nonexistent node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const ancestors = listAncestorNodeIds(nodes, "nonexistent");
            assert.deepStrictEqual(ancestors, []);
        });
        it("should handle single level parent", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const ancestors = listAncestorNodeIds(nodes, "division");
            assert.deepStrictEqual(ancestors, ["company"]);
        });
    });
    describe("listDescendantNodeIds", () => {
        it("should return all descendants", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
            ];
            const descendants = listDescendantNodeIds(nodes, "company");
            assert.deepStrictEqual(new Set(descendants), new Set(["division", "dept", "team", "member"]));
        });
        it("should return empty array for leaf node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company" }),
            ];
            const descendants = listDescendantNodeIds(nodes, "member");
            assert.deepStrictEqual(descendants, []);
        });
        it("should return empty array for nonexistent node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const descendants = listDescendantNodeIds(nodes, "nonexistent");
            assert.deepStrictEqual(descendants, []);
        });
        it("should return direct children only", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
            ];
            const descendants = listDescendantNodeIds(nodes, "division");
            assert.deepStrictEqual(descendants.sort(), ["dept"]);
        });
    });
    describe("findRootNode", () => {
        it("should find root node (company)", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const root = findRootNode(nodes);
            assert.ok(root);
            assert.strictEqual(root.orgNodeId, "company");
            assert.strictEqual(root.nodeType, "company");
        });
        it("should return null for empty array", () => {
            const root = findRootNode([]);
            assert.strictEqual(root, null);
        });
        it("should return null when no root exists", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "nonexistent" }),
            ];
            const root = findRootNode(nodes);
            assert.strictEqual(root, null);
        });
    });
    describe("getNodesAtLevel", () => {
        it("should get nodes at level 0 (root)", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const level0 = getNodesAtLevel(nodes, 0);
            assert.strictEqual(level0.length, 1);
            assert.strictEqual(level0[0]?.orgNodeId, "company");
        });
        it("should get nodes at level 1", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division1", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "division2", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const level1 = getNodesAtLevel(nodes, 1);
            assert.strictEqual(level1.length, 2);
            assert.ok(level1.some((n) => n.orgNodeId === "division1"));
            assert.ok(level1.some((n) => n.orgNodeId === "division2"));
        });
        it("should return empty array for level with no nodes", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const level2 = getNodesAtLevel(nodes, 2);
            assert.strictEqual(level2.length, 0);
        });
    });
    describe("getNodeDepth", () => {
        it("should return 0 for root node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const depth = getNodeDepth(nodes, "company");
            assert.strictEqual(depth, 0);
        });
        it("should return correct depth for nested nodes", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "dept" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team" }),
            ];
            assert.strictEqual(getNodeDepth(nodes, "company"), 0);
            assert.strictEqual(getNodeDepth(nodes, "division"), 1);
            assert.strictEqual(getNodeDepth(nodes, "dept"), 2);
            assert.strictEqual(getNodeDepth(nodes, "team"), 3);
            assert.strictEqual(getNodeDepth(nodes, "member"), 4);
        });
        it("should return 0 for nonexistent node", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const depth = getNodeDepth(nodes, "nonexistent");
            assert.strictEqual(depth, 0);
        });
    });
    describe("findLowestCommonAncestor", () => {
        it("should find LCA for sibling nodes", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept1", nodeType: "department", parentOrgNodeId: "division" }),
                createOrgNode({ orgNodeId: "dept2", nodeType: "department", parentOrgNodeId: "division" }),
            ];
            const lca = findLowestCommonAncestor(nodes, "dept1", "dept2");
            assert.strictEqual(lca, "division");
        });
        it("should find LCA when one node is ancestor of other", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "dept", nodeType: "department", parentOrgNodeId: "division" }),
            ];
            const lca = findLowestCommonAncestor(nodes, "division", "dept");
            assert.strictEqual(lca, "division");
        });
        it("should return null when no common ancestor exists", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "division", nodeType: "division", parentOrgNodeId: "company" }),
            ];
            const lca = findLowestCommonAncestor(nodes, "company", "division");
            assert.strictEqual(lca, "company");
        });
        it("should return null for nonexistent nodes", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const lca = findLowestCommonAncestor(nodes, "nonexistent1", "nonexistent2");
            assert.strictEqual(lca, null);
        });
    });
});
describe("OrgModelService - Org Change Events", () => {
    describe("detectOrgChangeEvents", () => {
        it("should detect employee onboarding", () => {
            const before = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const after = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
            ];
            const events = detectOrgChangeEvents(before, after);
            assert.ok(events.some((e) => e.type === "employee_onboarding"));
            const onboarding = events.find((e) => e.type === "employee_onboarding");
            assert.strictEqual(onboarding.userId, "user-1");
            assert.strictEqual(onboarding.teamId, "company");
        });
        it("should detect employee offboarding", () => {
            const before = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
            ];
            const after = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const events = detectOrgChangeEvents(before, after);
            assert.ok(events.some((e) => e.type === "employee_offboarding"));
            const offboarding = events.find((e) => e.type === "employee_offboarding");
            assert.strictEqual(offboarding.userId, "user-1");
            assert.strictEqual(offboarding.teamId, "company");
        });
        it("should detect employee transfer", () => {
            const before = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "team1", nodeType: "team", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "team2", nodeType: "team", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team1", ownerUserIds: ["user-1"] }),
            ];
            const after = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "team1", nodeType: "team", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "team2", nodeType: "team", parentOrgNodeId: "company" }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "team2", ownerUserIds: ["user-1"] }),
            ];
            const events = detectOrgChangeEvents(before, after);
            assert.ok(events.some((e) => e.type === "employee_transfer"));
            const transfer = events.find((e) => e.type === "employee_transfer");
            assert.strictEqual(transfer.userId, "user-1");
            assert.strictEqual(transfer.fromTeamId, "team1");
            assert.strictEqual(transfer.toTeamId, "team2");
        });
        it("should return empty array when no changes", () => {
            const nodes = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
            ];
            const events = detectOrgChangeEvents(nodes, nodes);
            assert.strictEqual(events.length, 0);
        });
        it("should detect multiple events", () => {
            const before = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member1", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-1"] }),
            ];
            const after = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "member1", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-2"] }), // changed owner
                createOrgNode({ orgNodeId: "member2", nodeType: "member", parentOrgNodeId: "company", ownerUserIds: ["user-3"] }), // new
            ];
            const events = detectOrgChangeEvents(before, after);
            assert.ok(events.some((e) => e.type === "employee_onboarding"));
            // Note: user-1 to user-2 is not a transfer, it's just an owner change on existing node
        });
        it("should ignore non-member nodes for offboarding/onboarding", () => {
            const before = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
                createOrgNode({ orgNodeId: "team", nodeType: "team", parentOrgNodeId: "company" }),
            ];
            const after = [
                createOrgNode({ orgNodeId: "company", nodeType: "company", parentOrgNodeId: null }),
            ];
            const events = detectOrgChangeEvents(before, after);
            // Team removal should not trigger offboarding (only members)
            assert.ok(!events.some((e) => e.type === "employee_offboarding"));
        });
    });
});
