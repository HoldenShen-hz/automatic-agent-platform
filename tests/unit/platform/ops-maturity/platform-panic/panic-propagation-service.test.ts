import assert from "node:assert/strict";
import test from "node:test";

import {
  PanicPropagationService,
  PlatformPanicService,
} from "../../../../../src/platform/ops-maturity/platform-panic/index.js";

test("PanicPropagationService cascades halt and emits propagation records for all planes", () => {
  const panicService = new PlatformPanicService();
  const propagation = new PanicPropagationService(panicService);
  const activation = panicService.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre-lead",
    requiredApprovers: ["sre-lead", "security-lead"],
  });

  const events = propagation.cascadeHalt(activation);
  const records = propagation.getPropagationRecords(activation.directive.directiveId);

  assert.equal(events.length, 5);
  assert.equal(events[0]?.plane, "P1");
  assert.equal(events[0]?.localState, "halted");
  assert.equal(records.length, 5);
  assert.ok(records.every((record) => record.directiveId === activation.directive.directiveId));
});

test("PanicPropagationService tracks dual-admin acknowledgments and resume directives", () => {
  const panicService = new PlatformPanicService();
  const propagation = new PanicPropagationService(panicService);
  const activation = panicService.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre-lead",
    requiredApprovers: ["sre-lead", "security-lead"],
  });

  propagation.cascadeHalt(activation);
  for (const plane of ["P1", "P2", "P3", "P4", "P5"] as const) {
    propagation.recordAcknowledgment(
      activation.directive.directiveId,
      plane,
      "sre-lead",
      "security-lead",
      "halted",
      `artifact://panic/${plane}`,
    );
    propagation.markPlaneAcknowledged(activation.directive.directiveId, plane);
  }

  const confirmation = propagation.getConfirmation(activation.directive.directiveId, "P1");
  const resumeDirective = propagation.issueResumeDirective(
    "platform",
    activation.directive.directiveId,
    ["sre-lead", "security-lead"],
    true,
    ["smoke_passed"],
    true,
  );

  assert.ok(confirmation != null);
  assert.equal(propagation.allPlanesAcknowledged(activation.directive.directiveId), true);
  assert.equal(resumeDirective.relatedPanicDirectiveId, activation.directive.directiveId);
});
