/**
 * Smoke Test: Configuration Loading
 *
 * Verifies configuration loads correctly with safe defaults.
 * Part of the smoke test suite in tests/integration/smoke/.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
test("smoke: default configuration loads without exceptions", async () => {
    const configPath = resolve(process.cwd(), "config/runtime/default.json");
    const fs = await import("node:fs/promises");
    const configContent = await fs.readFile(configPath, "utf-8");
    assert.ok(configContent.length > 0, "Default config should not be empty");
    const config = JSON.parse(configContent);
    // Verify basic structure - runtime config has these fields
    assert.ok(config.maxConcurrentTasks !== undefined, "Config should have maxConcurrentTasks");
    assert.ok(config.defaultTaskTimeoutMs !== undefined, "Config should have defaultTaskTimeoutMs");
    assert.ok(config.defaultStepTimeoutMs !== undefined, "Config should have defaultStepTimeoutMs");
    // Verify safe defaults
    assert.ok(config.maxConcurrentTasks >= 1, "maxConcurrentTasks should be at least 1");
    assert.ok(config.defaultTaskTimeoutMs > 0, "defaultTaskTimeoutMs should be positive");
});
test("smoke: division directories exist", async () => {
    const divisionsPath = resolve(process.cwd(), "divisions");
    const fs = await import("node:fs/promises");
    // Divisions are directories
    const divisionsStat = await fs.stat(divisionsPath);
    assert.ok(divisionsStat.isDirectory(), "divisions should be a directory");
    // Read division names
    const divisions = await fs.readdir(divisionsPath);
    assert.ok(divisions.length > 0, "Should have at least one division");
    // Verify first division has expected structure
    const firstDivisionPath = resolve(divisionsPath, divisions[0]);
    const divisionStat = await fs.stat(firstDivisionPath);
    assert.ok(divisionStat.isDirectory(), "Division should be a directory");
});
//# sourceMappingURL=config-smoke.test.js.map