import assert from "node:assert/strict";
import test from "node:test";
import { PhaseDeliveryService } from "../../../../src/domains/roadmap/phase-delivery-service.js";
test("PhaseDeliveryService creates a new phase", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    assert.equal(phase.phase, "phase1");
    assert.ok(phase.phaseId.startsWith("phase_phase1"));
    assert.equal(phase.name, "Foundation");
    assert.equal(phase.status, "pending");
    assert.ok(phase.createdAt);
    assert.ok(phase.updatedAt);
});
test("PhaseDeliveryService creates phases with correct names", () => {
    const service = new PhaseDeliveryService();
    const phase1 = service.createPhase("phase1");
    assert.equal(phase1.name, "Foundation");
    assert.equal(phase1.description, "Core execution, state management");
    const phase2 = service.createPhase("phase2");
    assert.equal(phase2.name, "Growth");
    assert.equal(phase2.description, "Multi-region, scaling");
    const phase3 = service.createPhase("phase3");
    assert.equal(phase3.name, "Maturity");
    assert.equal(phase3.description, "Full features, HA/DR");
    const phase4 = service.createPhase("phase4");
    assert.equal(phase4.name, "Enterprise");
    assert.equal(phase4.description, "Advanced governance, compliance");
});
test("PhaseDeliveryService throws when creating duplicate phase", () => {
    const service = new PhaseDeliveryService();
    service.createPhase("phase1");
    assert.throws(() => service.createPhase("phase1"), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "phase_delivery.phase_exists";
        }
        return false;
    });
});
test("PhaseDeliveryService adds deliverable to phase", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    const deliverable = service.addDeliverableToPhase(phase.phaseId, {
        title: "Core Engine",
        description: "Implement core execution engine",
    });
    assert.ok(deliverable.deliverableId.startsWith("deliverable_"));
    assert.equal(deliverable.title, "Core Engine");
    assert.equal(deliverable.description, "Implement core execution engine");
    assert.equal(deliverable.phaseId, phase.phaseId);
    assert.equal(deliverable.completedAt, undefined);
});
test("PhaseDeliveryService throws for non-existent phase when adding deliverable", () => {
    const service = new PhaseDeliveryService();
    assert.throws(() => service.addDeliverableToPhase("non_existent", {
        title: "Test",
        description: "Test",
    }), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "phase_delivery.phase_not_found";
        }
        return false;
    });
});
test("PhaseDeliveryService marks deliverable as complete", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    const deliverable = service.addDeliverableToPhase(phase.phaseId, {
        title: "Core Engine",
        description: "Implement core execution engine",
    });
    const completed = service.markDeliverableComplete(phase.phaseId, deliverable.deliverableId);
    assert.ok(completed.completedAt);
    assert.notEqual(completed.completedAt, undefined);
});
test("PhaseDeliveryService throws when marking deliverable from different phase", () => {
    const service = new PhaseDeliveryService();
    const phase1 = service.createPhase("phase1");
    const phase2 = service.createPhase("phase2");
    const deliverable = service.addDeliverableToPhase(phase1.phaseId, {
        title: "Test",
        description: "Test",
    });
    assert.throws(() => service.markDeliverableComplete(phase2.phaseId, deliverable.deliverableId), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "phase_delivery.deliverable_phase_mismatch";
        }
        return false;
    });
});
test("PhaseDeliveryService throws for non-existent deliverable", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    assert.throws(() => service.markDeliverableComplete(phase.phaseId, "non_existent"), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "phase_delivery.deliverable_not_found";
        }
        return false;
    });
});
test("PhaseDeliveryService calculates phase progress", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    // Add 4 deliverables
    const d1 = service.addDeliverableToPhase(phase.phaseId, { title: "D1", description: "D1" });
    const d2 = service.addDeliverableToPhase(phase.phaseId, { title: "D2", description: "D2" });
    const d3 = service.addDeliverableToPhase(phase.phaseId, { title: "D3", description: "D3" });
    const d4 = service.addDeliverableToPhase(phase.phaseId, { title: "D4", description: "D4" });
    // Complete 2 of them
    service.markDeliverableComplete(phase.phaseId, d1.deliverableId);
    service.markDeliverableComplete(phase.phaseId, d2.deliverableId);
    const progress = service.getPhaseProgress(phase.phaseId);
    assert.equal(progress.totalDeliverables, 4);
    assert.equal(progress.completedDeliverables, 2);
    assert.equal(progress.completionPercentage, 50);
});
test("PhaseDeliveryService handles empty phase progress", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    const progress = service.getPhaseProgress(phase.phaseId);
    assert.equal(progress.totalDeliverables, 0);
    assert.equal(progress.completedDeliverables, 0);
    assert.equal(progress.completionPercentage, 0);
});
test("PhaseDeliveryService lists all phases", () => {
    const service = new PhaseDeliveryService();
    service.createPhase("phase1");
    service.createPhase("phase2");
    service.createPhase("phase3");
    const phases = service.listPhases();
    assert.equal(phases.length, 3);
});
test("PhaseDeliveryService returns phases sorted by createdAt", () => {
    const service = new PhaseDeliveryService();
    const phase1 = service.createPhase("phase1");
    const phase2 = service.createPhase("phase2");
    const phases = service.listPhases();
    assert.equal(phases[0]?.phase, "phase1");
    assert.ok(phases[0].createdAt <= phases[1].createdAt);
});
test("PhaseDeliveryService creates all phase8 phases with correct metadata", () => {
    const service = new PhaseDeliveryService();
    const phase8a = service.createPhase("phase8a");
    assert.equal(phase8a.name, "Harness Core Protocol");
    assert.equal(phase8a.description, "Harness loop protocol, core runtime, and constraint model");
    const phase8b = service.createPhase("phase8b");
    assert.equal(phase8b.name, "Harness Long-Running and HITL");
    assert.equal(phase8b.description, "Harness durability, context, recovery, and HITL runtime");
    const phase8c = service.createPhase("phase8c");
    assert.equal(phase8c.name, "Harness Governance and Evaluation");
    assert.equal(phase8c.description, "Harness guardrails, evaluation, async execution, and invariants");
});
test("PhaseDeliveryService creates all phase9 phases with correct metadata", () => {
    const service = new PhaseDeliveryService();
    const phase9a = service.createPhase("phase9a");
    assert.equal(phase9a.name, "Vertical Domains Batch 9a");
    assert.equal(phase9a.description, "Coding, data engineering, knowledge base, and user operations");
    const phase9b = service.createPhase("phase9b");
    assert.equal(phase9b.name, "Vertical Domains Batch 9b");
    assert.equal(phase9b.description, "Quant trading, financial services, ecommerce, and advertising");
    const phase9c = service.createPhase("phase9c");
    assert.equal(phase9c.name, "Vertical Domains Batch 9c");
    assert.equal(phase9c.description, "Industry research, academic research, finance accounting, and legal");
    const phase9d = service.createPhase("phase9d");
    assert.equal(phase9d.name, "Vertical Domains Batch 9d");
    assert.equal(phase9d.description, "Customer service, IT operations, moderation, and live streaming");
    const phase9e = service.createPhase("phase9e");
    assert.equal(phase9e.name, "Vertical Domains Batch 9e");
    assert.equal(phase9e.description, "Healthcare, human resources, supply chain, and education");
    const phase9f = service.createPhase("phase9f");
    assert.equal(phase9f.name, "Vertical Domains Batch 9f");
    assert.equal(phase9f.description, "Creative production, game dev, publishing, and marketing");
});
test("PhaseDeliveryService calculates 100% progress when all deliverables complete", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    const d1 = service.addDeliverableToPhase(phase.phaseId, { title: "D1", description: "D1" });
    const d2 = service.addDeliverableToPhase(phase.phaseId, { title: "D2", description: "D2" });
    service.markDeliverableComplete(phase.phaseId, d1.deliverableId);
    service.markDeliverableComplete(phase.phaseId, d2.deliverableId);
    const progress = service.getPhaseProgress(phase.phaseId);
    assert.equal(progress.completionPercentage, 100);
});
test("PhaseDeliveryService calculates 0% progress when no deliverables complete", () => {
    const service = new PhaseDeliveryService();
    const phase = service.createPhase("phase1");
    service.addDeliverableToPhase(phase.phaseId, { title: "D1", description: "D1" });
    service.addDeliverableToPhase(phase.phaseId, { title: "D2", description: "D2" });
    const progress = service.getPhaseProgress(phase.phaseId);
    assert.equal(progress.completionPercentage, 0);
});
test("PhaseDeliveryService throws for non-existent phase when getting progress", () => {
    const service = new PhaseDeliveryService();
    assert.throws(() => service.getPhaseProgress("non_existent"), (err) => {
        if (err instanceof Error && "code" in err) {
            return err.code === "phase_delivery.phase_not_found";
        }
        return false;
    });
});
//# sourceMappingURL=phase-delivery-service.test.js.map