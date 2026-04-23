import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OrgNodeTypeSchema, OrgNodeSchema, isLeafOrgNode, getPlatformMapping, validateHierarchyDepth, createCrossOrgCollaborator, } from "../../../../src/org-governance/org-model/org-node/index.js";
import { validateOrgHierarchy, listAncestorNodeIds, listDescendantNodeIds, findRootNode, getNodesAtLevel, getNodeDepth, findLowestCommonAncestor, buildReportingChain, detectOrgChangeEvents, } from "../../../../src/org-governance/org-model/hierarchy/index.js";
import { mergeOrgNodes, buildOrgChart, diffOrgCharts, } from "../../../../src/org-governance/org-model/sync/index.js";
describe("OrgNodeTypeSchema - 5-level hierarchy", () => {
    test("should accept valid org node types", () => {
        const validTypes = ["company", "division", "department", "team", "member"];
        for (const type of validTypes) {
            const result = OrgNodeTypeSchema.safeParse(type);
            assert.strictEqual(result.success, true, `Type ${type} should be valid`);
        }
    });
    test("should reject invalid org node types", () => {
        const result = OrgNodeSchema.safeParse({
            orgNodeId: "node-1",
            nodeType: "invalid_type",
            displayName: "Test",
        });
        assert.strictEqual(result.success, false);
    });
});
describe("OrgNodeSchema", () => {
    test("should parse a valid org node", () => {
        const node = {
            orgNodeId: "company-1",
            nodeType: "company",
            displayName: "Acme Corp",
            parentOrgNodeId: null,
            ownerUserIds: ["ceo-1"],
            active: true,
        };
        const result = OrgNodeSchema.safeParse(node);
        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.data.nodeType, "company");
            assert.strictEqual(result.data.displayName, "Acme Corp");
        }
    });
    test("should apply default values", () => {
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
    test("should reject empty orgNodeId", () => {
        const result = OrgNodeSchema.safeParse({
            orgNodeId: "",
            nodeType: "team",
            displayName: "Test",
        });
        assert.strictEqual(result.success, false);
    });
});
describe("isLeafOrgNode", () => {
    test("should return true for member nodes", () => {
        const memberNode = {
            orgNodeId: "member-1",
            nodeType: "member",
            displayName: "John Doe",
            parentOrgNodeId: "team-1",
            ownerUserIds: ["user-1"],
            active: true,
            costCenter: "",
            metadata: {},
        };
        assert.strictEqual(isLeafOrgNode(memberNode), true);
    });
    test("should return false for non-member nodes", () => {
        const teamNode = {
            orgNodeId: "team-1",
            nodeType: "team",
            displayName: "Engineering Team",
            parentOrgNodeId: "dept-1",
            ownerUserIds: ["manager-1"],
            active: true,
            costCenter: "CC-001",
            metadata: {},
        };
        assert.strictEqual(isLeafOrgNode(teamNode), false);
    });
});
describe("getPlatformMapping", () => {
    const mappings = [
        ["company", "platform"],
        ["division", "tenant_group"],
        ["department", "tenant"],
        ["team", "domain/pack_group"],
        ["member", "principal"],
    ];
    mappings.forEach(([nodeType, expected]) => {
        test(`should map ${nodeType} to ${expected}`, () => {
            assert.strictEqual(getPlatformMapping(nodeType), expected);
        });
    });
});
describe("validateHierarchyDepth", () => {
    test("should return valid for empty nodes", () => {
        const result = validateHierarchyDepth([]);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.depth, 0);
    });
    test("should return valid for flat 2-level hierarchy", () => {
        const nodes = [
            {
                orgNodeId: "company-1",
                nodeType: "company",
                displayName: "Acme",
                parentOrgNodeId: null,
                ownerUserIds: [],
                active: true,
                costCenter: "",
                metadata: {},
            },
            {
                orgNodeId: "dept-1",
                nodeType: "department",
                displayName: "Eng",
                parentOrgNodeId: "company-1",
                ownerUserIds: [],
                active: true,
                costCenter: "",
                metadata: {},
            },
        ];
        const result = validateHierarchyDepth(nodes);
        assert.strictEqual(result.valid, true);
        assert.ok(result.depth <= 5);
    });
    test("should return valid for full 5-level hierarchy", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "dept1", nodeType: "department", displayName: "Dept", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "dept1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "t1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const result = validateHierarchyDepth(nodes);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.depth, 5);
    });
});
describe("CrossOrgCollaborator", () => {
    test("should create cross-org collaborator", () => {
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
        assert.ok(collaborator.collaboratorId.startsWith("collab:"));
        assert.strictEqual(collaborator.active, true);
        assert.ok(collaborator.grantedAt);
    });
});
describe("validateOrgHierarchy", () => {
    test("should return empty findings for valid hierarchy", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const findings = validateOrgHierarchy(nodes);
        assert.strictEqual(findings.length, 0);
    });
    test("should detect missing parent", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "nonexistent", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const findings = validateOrgHierarchy(nodes);
        assert.ok(findings.some((f) => f.includes("missing_parent")));
    });
    test("should detect self-cycle", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const findings = validateOrgHierarchy(nodes);
        assert.ok(findings.some((f) => f.includes("self_cycle")));
    });
});
describe("listAncestorNodeIds", () => {
    test("should return ancestors in order", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const ancestors = listAncestorNodeIds(nodes, "t1");
        assert.deepStrictEqual(ancestors, ["d1", "c1"]);
    });
    test("should return empty for root node", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const ancestors = listAncestorNodeIds(nodes, "c1");
        assert.deepStrictEqual(ancestors, []);
    });
});
describe("listDescendantNodeIds", () => {
    test("should return all descendants", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "t1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const descendants = listDescendantNodeIds(nodes, "c1");
        assert.deepStrictEqual(new Set(descendants), new Set(["d1", "t1", "m1"]));
    });
});
describe("findRootNode", () => {
    test("should find root node", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const root = findRootNode(nodes);
        assert.ok(root);
        assert.strictEqual(root.orgNodeId, "c1");
    });
    test("should return null for empty nodes", () => {
        const root = findRootNode([]);
        assert.strictEqual(root, null);
    });
});
describe("getNodesAtLevel", () => {
    test("should get nodes at specific level", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D1", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d2", nodeType: "division", displayName: "D2", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const level1Nodes = getNodesAtLevel(nodes, 1);
        assert.strictEqual(level1Nodes.length, 2);
    });
});
describe("getNodeDepth", () => {
    test("should calculate correct depth", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        assert.strictEqual(getNodeDepth(nodes, "c1"), 0);
        assert.strictEqual(getNodeDepth(nodes, "d1"), 1);
        assert.strictEqual(getNodeDepth(nodes, "t1"), 2);
    });
});
describe("findLowestCommonAncestor", () => {
    test("should find LCA of two nodes", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D1", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T1", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t2", nodeType: "team", displayName: "T2", parentOrgNodeId: "d1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const lca = findLowestCommonAncestor(nodes, "t1", "t2");
        assert.strictEqual(lca, "d1");
    });
});
describe("buildReportingChain", () => {
    test("should build reporting chain", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: ["vp"], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T", parentOrgNodeId: "d1", ownerUserIds: ["manager"], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "t1", ownerUserIds: ["employee"], active: true, costCenter: "", metadata: {} },
        ];
        const chain = buildReportingChain(nodes, "employee", "m1");
        assert.deepStrictEqual(chain, ["manager", "vp", "ceo"]);
    });
});
describe("detectOrgChangeEvents", () => {
    test("should detect employee onboarding", () => {
        const before = [];
        const after = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "c1", ownerUserIds: ["user-1"], active: true, costCenter: "", metadata: {} },
        ];
        const events = detectOrgChangeEvents(before, after);
        assert.ok(events.some((e) => e.type === "employee_onboarding"));
    });
    test("should detect employee offboarding", () => {
        const before = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "c1", ownerUserIds: ["user-1"], active: true, costCenter: "", metadata: {} },
        ];
        const after = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const events = detectOrgChangeEvents(before, after);
        assert.ok(events.some((e) => e.type === "employee_offboarding"));
    });
    test("should detect employee transfer", () => {
        const before = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T1", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t2", nodeType: "team", displayName: "T2", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "t1", ownerUserIds: ["user-1"], active: true, costCenter: "", metadata: {} },
        ];
        const after = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t1", nodeType: "team", displayName: "T1", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "t2", nodeType: "team", displayName: "T2", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "m1", nodeType: "member", displayName: "M", parentOrgNodeId: "t2", ownerUserIds: ["user-1"], active: true, costCenter: "", metadata: {} },
        ];
        const events = detectOrgChangeEvents(before, after);
        assert.ok(events.some((e) => e.type === "employee_transfer"));
    });
});
describe("OrgChart and sync", () => {
    test("should build org chart", () => {
        const nodes = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const chart = buildOrgChart(nodes, "scim");
        assert.strictEqual(chart.root.orgNodeId, "c1");
        assert.strictEqual(chart.nodes.length, 2);
        assert.strictEqual(chart.syncSource, "scim");
    });
    test("should merge org nodes", () => {
        const existing = [
            { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const incoming = [
            { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        ];
        const merged = mergeOrgNodes(existing, incoming);
        assert.strictEqual(merged.length, 2);
    });
    test("should diff org charts", () => {
        const before = {
            root: { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            nodes: [
                { orgNodeId: "c1", nodeType: "company", displayName: "C", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            ],
            syncSource: "scim",
            lastSyncedAt: "2024-01-01T00:00:00Z",
        };
        const after = {
            root: { orgNodeId: "c1", nodeType: "company", displayName: "C Updated", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            nodes: [
                { orgNodeId: "c1", nodeType: "company", displayName: "C Updated", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
                { orgNodeId: "d1", nodeType: "division", displayName: "D", parentOrgNodeId: "c1", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
            ],
            syncSource: "scim",
            lastSyncedAt: "2024-01-02T00:00:00Z",
        };
        const changed = diffOrgCharts(before, after);
        assert.ok(changed.includes("c1"));
        assert.ok(changed.includes("d1"));
    });
});
//# sourceMappingURL=org-model.test.js.map