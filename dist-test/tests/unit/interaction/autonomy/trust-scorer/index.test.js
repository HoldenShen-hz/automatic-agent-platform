import assert from "node:assert/strict";
import test from "node:test";
import { calculateTrustScore, mapTrustLevel } from "../../../../../src/interaction/autonomy/trust-scorer/index.js";
function makeScore(overrides = {}) {
    return {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 0,
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 3,
        humanOverrides: 2,
        incidents: 0,
        lastIncidentAgeDays: null,
        ...overrides,
    };
}
test("calculateTrustScore returns 0 when no executions", () => {
    const score = makeScore({ totalExecutions: 0, successfulExecutions: 0 });
    assert.equal(calculateTrustScore(score), 0);
});
test("calculateTrustScore applies success points correctly", () => {
    const score = makeScore({ totalExecutions: 100, successfulExecutions: 100 });
    const result = calculateTrustScore(score);
    assert.equal(result, 100);
});
test("calculateTrustScore applies human override penalty", () => {
    // Use low volume to avoid volume bonus compensating for override penalty
    const withoutOverride = makeScore({ totalExecutions: 30, successfulExecutions: 30, humanOverrides: 0, incidents: 0 });
    const withOverride = makeScore({ totalExecutions: 30, successfulExecutions: 30, humanOverrides: 10, incidents: 0 });
    const withoutResult = calculateTrustScore(withoutOverride);
    const withResult = calculateTrustScore(withOverride);
    assert.equal(withoutResult, 100);
    // 100 - (10/30)*20 = 100 - 6.67 = 93.33 -> round to 93
    assert.equal(withResult, 93);
    assert.ok(withResult < withoutResult, "Override penalty should reduce score");
});
test("calculateTrustScore applies incident penalty", () => {
    const score = makeScore({ totalExecutions: 100, successfulExecutions: 95, incidents: 2 });
    const result = calculateTrustScore(score);
    assert.ok(result < 95, "Incident penalty should reduce score");
});
test("calculateTrustScore applies volume bonus up to 10 points", () => {
    const lowVolume = makeScore({ totalExecutions: 25, successfulExecutions: 25, humanOverrides: 0 });
    const highVolume = makeScore({ totalExecutions: 500, successfulExecutions: 500, humanOverrides: 0 });
    // Volume bonus is only given when volume > 50, so lowVolume gets no bonus but highVolume does
    assert.equal(calculateTrustScore(lowVolume), 100); // no volume bonus at 25
    assert.equal(calculateTrustScore(highVolume), 100); // capped at 100 with volume bonus
});
test("calculateTrustScore caps at 100 and floors at 0", () => {
    const perfect = makeScore({ totalExecutions: 1000, successfulExecutions: 1000, humanOverrides: 0, incidents: 0 });
    assert.equal(calculateTrustScore(perfect), 100);
    const terrible = makeScore({ totalExecutions: 100, successfulExecutions: 0, humanOverrides: 100, incidents: 10 });
    assert.equal(calculateTrustScore(terrible), 0);
});
test("mapTrustLevel returns fully_trusted for score >= 95", () => {
    assert.equal(mapTrustLevel(95), "fully_trusted");
    assert.equal(mapTrustLevel(100), "fully_trusted");
});
test("mapTrustLevel returns trusted for score >= 85 and < 95", () => {
    assert.equal(mapTrustLevel(85), "trusted");
    assert.equal(mapTrustLevel(94), "trusted");
});
test("mapTrustLevel returns semi_trusted for score >= 70 and < 85", () => {
    assert.equal(mapTrustLevel(70), "semi_trusted");
    assert.equal(mapTrustLevel(84), "semi_trusted");
});
test("mapTrustLevel returns supervised for score >= 50 and < 70", () => {
    assert.equal(mapTrustLevel(50), "supervised");
    assert.equal(mapTrustLevel(69), "supervised");
});
test("mapTrustLevel returns probation for score >= 30 and < 50", () => {
    assert.equal(mapTrustLevel(30), "probation");
    assert.equal(mapTrustLevel(49), "probation");
});
test("mapTrustLevel returns untrusted for score < 30", () => {
    assert.equal(mapTrustLevel(0), "untrusted");
    assert.equal(mapTrustLevel(29), "untrusted");
});
test("calculateTrustScore handles edge case of all overrides", () => {
    const score = makeScore({ totalExecutions: 10, successfulExecutions: 0, humanOverrides: 10, incidents: 0 });
    const result = calculateTrustScore(score);
    assert.equal(result, 0);
});
test("calculateTrustScore handles high volume with bonus", () => {
    const score = makeScore({
        totalExecutions: 300,
        successfulExecutions: 300,
        humanOverrides: 0,
        incidents: 0,
    });
    // 100 success points - 0 penalty + 6 volume bonus = 106 -> capped at 100
    assert.equal(calculateTrustScore(score), 100);
});
test("calculateTrustScore with realistic deployment scenario", () => {
    const score = makeScore({
        capabilityId: "k8s_deploy",
        totalExecutions: 520,
        successfulExecutions: 516,
        failedExecutions: 1,
        humanOverrides: 2,
        incidents: 1,
        lastIncidentAgeDays: 30,
        lastIncidentSeverity: "P2",
    });
    const result = calculateTrustScore(score);
    // successPoints = 99.23, overridePenalty = 0.08, incidentPenalty = 15, volumeBonus = 10
    // result = round(99.23 - 0.08 - 15 + 10) = 94
    assert.equal(result, 94);
});
//# sourceMappingURL=index.test.js.map