import assert from "node:assert/strict";
import test from "node:test";
import { ProgressiveAutonomyService, AutonomyAuditService, autonomyAuditService, } from "../../../../src/interaction/autonomy/index.js";
function makeProfile(overrides = {}) {
    return {
        agentId: "agent_1",
        domainId: "engineering_ops",
        overallTrustLevel: "trusted",
        lastEvaluation: "2026-04-19T00:00:00.000Z",
        capabilityScores: [
            {
                capabilityId: "deploy",
                currentAutonomy: "semi_auto",
                trustScore: 90,
                totalExecutions: 520,
                successfulExecutions: 516,
                failedExecutions: 1,
                humanOverrides: 2,
                incidents: 0,
                lastIncidentAgeDays: 120,
            },
        ],
        ...overrides,
    };
}
test("ProgressiveAutonomyService promotes highly reliable capability to full_auto", () => {
    const service = new ProgressiveAutonomyService();
    const evaluation = service.evaluateProfile(makeProfile());
    assert.equal(evaluation.decision.level, "full_auto");
    assert.equal(evaluation.decision.trustLevel, "fully_trusted");
    assert.equal(evaluation.capabilityLevels.deploy, "full_auto");
    assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.promoted");
});
test("ProgressiveAutonomyService demotes risky capability to suggestion", () => {
    const service = new ProgressiveAutonomyService();
    const evaluation = service.evaluateProfile(makeProfile({
        capabilityScores: [
            {
                capabilityId: "deploy",
                currentAutonomy: "semi_auto",
                trustScore: 40,
                totalExecutions: 60,
                successfulExecutions: 50,
                failedExecutions: 5,
                humanOverrides: 8,
                incidents: 1,
                lastIncidentAgeDays: 1,
            },
        ],
    }), { freezeOnIncident: false, windowDays: 30, minVolumeForPromotion: 10, minVolumeForDemotion: 3 });
    assert.equal(evaluation.decision.level, "suggestion");
    assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.demoted");
});
test("ProgressiveAutonomyService returns untrusted suggestion for unknown subject", async () => {
    const service = new ProgressiveAutonomyService();
    const decision = await service.evaluate("missing_agent");
    assert.equal(decision.level, "suggestion");
    assert.equal(decision.trustLevel, "untrusted");
});
test("AutonomyAuditService records autonomy change events", () => {
    const audit = new AutonomyAuditService();
    const event = {
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "deploy",
        fromLevel: "semi_auto",
        toLevel: "full_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: {
            successRate: 0.99,
            totalExecutions: 520,
            incidentCount: 0,
            evaluationWindow: "30d",
        },
    };
    const record = audit.recordChange(event);
    assert.equal(record.agentId, "agent_1");
    assert.equal(record.capabilityId, "deploy");
    assert.equal(record.eventType, "agent.autonomy.promoted");
    assert.equal(record.fromLevel, "semi_auto");
    assert.equal(record.toLevel, "full_auto");
    assert.equal(record.successRate, 0.99);
    assert.ok(record.id.startsWith("autonomy_audit_"));
    assert.ok(record.createdAt.length > 0);
});
test("AutonomyAuditService filters records by agent", () => {
    const audit = new AutonomyAuditService();
    audit.recordChange({
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "deploy",
        fromLevel: "supervised",
        toLevel: "semi_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.98, totalExecutions: 300, incidentCount: 0, evaluationWindow: "30d" },
    });
    audit.recordChange({
        eventType: "agent.autonomy.demoted",
        agentId: "agent_2",
        capabilityId: "rollback",
        fromLevel: "semi_auto",
        toLevel: "suggestion",
        trigger: "incident_response",
        approvedBy: "auto",
        evidence: { successRate: 0.7, totalExecutions: 100, incidentCount: 2, evaluationWindow: "30d" },
    });
    const agent1Records = audit.getByAgent("agent_1");
    assert.equal(agent1Records.length, 1);
    assert.equal(agent1Records[0].agentId, "agent_1");
    const agent2Records = audit.getByAgent("agent_2");
    assert.equal(agent2Records.length, 1);
    assert.equal(agent2Records[0].agentId, "agent_2");
});
test("AutonomyAuditService generates summary statistics", () => {
    const audit = new AutonomyAuditService();
    audit.recordChange({
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "deploy",
        fromLevel: "supervised",
        toLevel: "semi_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.98, totalExecutions: 300, incidentCount: 0, evaluationWindow: "30d" },
    });
    audit.recordChange({
        eventType: "agent.autonomy.demoted",
        agentId: "agent_1",
        capabilityId: "rollback",
        fromLevel: "semi_auto",
        toLevel: "suggestion",
        trigger: "incident_response",
        approvedBy: "auto",
        evidence: { successRate: 0.7, totalExecutions: 100, incidentCount: 2, evaluationWindow: "30d" },
    });
    const summary = audit.getSummary("agent_1");
    assert.equal(summary.totalChanges, 2);
    assert.equal(summary.promotions, 1);
    assert.equal(summary.demotions, 1);
    assert.equal(summary.freezes, 0);
    assert.ok(summary.lastChangeAt !== null);
});
test("ProgressiveAutonomyService with audit callback wires up correctly", () => {
    const service = new ProgressiveAutonomyService();
    const audit = new AutonomyAuditService();
    service.onAutonomyChange((event) => audit.recordChange(event));
    service.evaluateProfile(makeProfile({
        capabilityScores: [
            {
                capabilityId: "deploy",
                currentAutonomy: "suggestion",
                trustScore: 50,
                totalExecutions: 100,
                successfulExecutions: 98,
                failedExecutions: 1,
                humanOverrides: 1,
                incidents: 0,
                lastIncidentAgeDays: null,
            },
        ],
    }));
    const records = audit.getByAgent("agent_1");
    assert.ok(records.length >= 1);
    assert.equal(records[0]?.eventType, "agent.autonomy.promoted");
});
test("AutonomyAuditService returns recent changes sorted by time", () => {
    const audit = new AutonomyAuditService();
    const event1 = {
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "cap_1",
        fromLevel: "suggestion",
        toLevel: "supervised",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.95, totalExecutions: 50, incidentCount: 0, evaluationWindow: "30d" },
    };
    audit.recordChange(event1);
    const event2 = {
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "cap_2",
        fromLevel: "supervised",
        toLevel: "semi_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.98, totalExecutions: 200, incidentCount: 0, evaluationWindow: "30d" },
    };
    audit.recordChange(event2);
    const recent = audit.getRecentChanges(5);
    assert.ok(recent.length === 2);
});
test("AutonomyAuditService provides listRecords for full audit trail", () => {
    const audit = new AutonomyAuditService();
    audit.recordChange({
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "deploy",
        fromLevel: "supervised",
        toLevel: "semi_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.98, totalExecutions: 300, incidentCount: 0, evaluationWindow: "30d" },
    });
    const allRecords = audit.listRecords();
    assert.ok(allRecords.length >= 1);
    assert.ok(allRecords[0].id.length > 0);
});
test("ProgressiveAutonomyService freezes on incident when option enabled", () => {
    const service = new ProgressiveAutonomyService();
    const audit = new AutonomyAuditService();
    service.onAutonomyChange((event) => audit.recordChange(event));
    const evaluation = service.evaluateProfile(makeProfile({
        capabilityScores: [
            {
                capabilityId: "deploy",
                currentAutonomy: "full_auto",
                trustScore: 85,
                totalExecutions: 600,
                successfulExecutions: 595,
                failedExecutions: 2,
                humanOverrides: 3,
                incidents: 1,
                lastIncidentAgeDays: 1,
            },
        ],
    }), { freezeOnIncident: true, windowDays: 30, minVolumeForPromotion: 10, minVolumeForDemotion: 3 });
    assert.equal(evaluation.decision.level, "frozen");
    const records = audit.getByAgent("agent_1");
    const freezeEvent = records.find((r) => r.eventType === "agent.autonomy.frozen");
    assert.ok(freezeEvent !== undefined, "Expected freeze event in audit trail");
});
test("ProgressiveAutonomyService does not freeze when freezeOnIncident is false", () => {
    const service = new ProgressiveAutonomyService();
    const evaluation = service.evaluateProfile(makeProfile({
        capabilityScores: [
            {
                capabilityId: "deploy",
                currentAutonomy: "full_auto",
                trustScore: 85,
                totalExecutions: 600,
                successfulExecutions: 595,
                failedExecutions: 2,
                humanOverrides: 3,
                incidents: 1,
                lastIncidentAgeDays: 1,
            },
        ],
    }), { freezeOnIncident: false, windowDays: 30, minVolumeForPromotion: 10, minVolumeForDemotion: 3 });
    assert.notEqual(evaluation.decision.level, "frozen");
});
test("AutonomyAuditService getByCapability filters correctly", () => {
    const audit = new AutonomyAuditService();
    audit.recordChange({
        eventType: "agent.autonomy.promoted",
        agentId: "agent_1",
        capabilityId: "deploy",
        fromLevel: "supervised",
        toLevel: "semi_auto",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.98, totalExecutions: 300, incidentCount: 0, evaluationWindow: "30d" },
    });
    audit.recordChange({
        eventType: "agent.autonomy.demoted",
        agentId: "agent_1",
        capabilityId: "rollback",
        fromLevel: "semi_auto",
        toLevel: "suggestion",
        trigger: "incident_response",
        approvedBy: "auto",
        evidence: { successRate: 0.7, totalExecutions: 100, incidentCount: 2, evaluationWindow: "30d" },
    });
    const deployRecords = audit.getByCapability("agent_1", "deploy");
    assert.equal(deployRecords.length, 1);
    assert.equal(deployRecords[0].capabilityId, "deploy");
    const rollbackRecords = audit.getByCapability("agent_1", "rollback");
    assert.equal(rollbackRecords.length, 1);
    assert.equal(rollbackRecords[0].capabilityId, "rollback");
});
test("Singleton autonomyAuditService is accessible and functional", () => {
    assert.ok(autonomyAuditService instanceof AutonomyAuditService);
    const before = autonomyAuditService.listRecords().length;
    autonomyAuditService.recordChange({
        eventType: "agent.autonomy.promoted",
        agentId: "singleton_test",
        capabilityId: "test",
        fromLevel: "suggestion",
        toLevel: "supervised",
        trigger: "rule_engine",
        approvedBy: "auto",
        evidence: { successRate: 0.95, totalExecutions: 50, incidentCount: 0, evaluationWindow: "30d" },
    });
    const after = autonomyAuditService.listRecords().length;
    assert.equal(after, before + 1);
});
//# sourceMappingURL=autonomy-audit-service.test.js.map