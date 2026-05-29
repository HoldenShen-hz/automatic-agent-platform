import { describe, expect, it } from "vitest";
import { mapMissionsToConsoleVm } from "../../../../../../packages/features/mission-console/src/hooks";
import { createMissionConsoleMobileCards } from "../../../../../../packages/features/mission-console/src/mobile";
const missions = [{
        missionId: "mis_001",
        tenantId: "tenant_001",
        type: "formal",
        status: "active",
        priority: "high",
        title: "Release Mission",
        objective: "Ship evidence-backed release",
        successCriteria: ["approved"],
        domainId: "coding",
        ownerPrincipalId: "user_001",
        accountablePrincipalId: "user_101",
        policyRefs: ["policy.release"],
        riskProfileRef: "risk.release",
        budgetEnvelopeRef: "budget_001",
        knowledgeBoundaryRef: "kb.release",
        defaultWorkflowTemplateRefs: ["wf.release"],
        updatedAt: "2026-05-21T00:00:00.000Z",
    }, {
        missionId: "mis_002",
        tenantId: "tenant_001",
        type: "incident",
        status: "paused",
        priority: "critical",
        title: "Incident Mission",
        objective: "Restore service",
        successCriteria: ["healthy"],
        domainId: "operations",
        ownerPrincipalId: "user_002",
        budgetEnvelopeRef: null,
        updatedAt: "2026-05-21T00:01:00.000Z",
    }];
describe("Mission Console VM seams", () => {
    it("selects requested Mission while keeping DTOs outside feature props", () => {
        const vm = mapMissionsToConsoleVm(missions, "mis_002");
        expect(vm.selectedMission?.title).toBe("Incident Mission");
        expect(vm.selectedMissionId).toBe("mis_002");
    });
    it("builds mobile cards from selected Mission evidence state", () => {
        const cards = createMissionConsoleMobileCards({
            loading: false,
            ...mapMissionsToConsoleVm(missions, "mis_001"),
            members: [{
                    membershipId: "mship_001",
                    missionId: "mis_001",
                    tenantId: "tenant_001",
                    principalType: "user",
                    principalId: "user_001",
                    role: "owner",
                    permissions: ["mission:read", "mission:execute"],
                    deniedPermissions: [],
                    status: "active",
                    grantedBy: "user_900",
                    grantedAt: "2026-05-21T00:00:00.000Z",
                    expiresAt: null,
                }],
            tasks: [],
            runs: [],
            evidence: [{ id: "ev_001", missionId: "mis_001", type: "evidence", status: "recorded", title: "Snapshot", ref: "hash", updatedAt: "2026-05-21T00:00:00.000Z" }],
            knowledge: [{ id: "know_001", missionId: "mis_001", type: "knowledge", status: "published", title: "Runbook", ref: "kb://release", updatedAt: "2026-05-21T00:00:00.000Z" }],
            learning: [{ id: "learn_001", missionId: "mis_001", type: "learning", status: "pending_promotion", title: "Retrospective", ref: "learning://release", updatedAt: "2026-05-21T00:00:00.000Z" }],
            budget: null,
            missionSettings: [],
            knowledgeLearningSummary: [],
            recommendedActions: [{ title: "Freeze mission", description: "Hard-stop runtime writes." }],
            operatorNotices: [],
            selectMission() { },
        });
        expect(cards[0]?.evidenceCount).toBe(1);
        expect(cards[1]?.evidenceCount).toBe(0);
        expect(cards[0]?.subtitle).toContain("members 1");
        expect(cards[0]?.subtitle).toContain("knowledge 1");
        expect(cards[0]?.subtitle).toContain("learning 1");
        expect(cards[0]?.subtitle).toContain("actions 1");
    });
});
