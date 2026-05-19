/**
 * Integration tests for PackSecurityService
 *
 * Tests the security scanning and dependency conflict detection functionality:
 * - Security scan execution and issue detection
 * - Dependency conflict detection and resolution
 * - Static analysis patterns
 * - Permission escalation detection
 *
 * @see src/scale-ecosystem/marketplace/pack-security-service.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PackSecurityService, } from "../../../../src/scale-ecosystem/marketplace/pack-security-service.js";
test("PackSecurityService runSecurityScan detects critical vulnerability patterns", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_malicious",
        version: "1.0.0",
        sourceUri: "inline:const result = exec(userInput);",
        manifestChecksum: "invalid-checksum-format",
        capabilities: ["exec"],
        permissions: ["exec:bash"],
    };
    const result = await service.runSecurityScan(input);
    assert.equal(result.packId, "pack_malicious");
    assert.equal(result.status, "failed");
    assert.ok(result.issues.length > 0);
    // Should detect the critical checksum issue
    const checksumIssues = result.issues.filter((i) => i.code === "PKG001" || i.code === "PKG002");
    assert.ok(checksumIssues.length > 0, "Should detect invalid checksum format");
    // Should detect critical vulnerability pattern
    const vulnIssues = result.issues.filter((i) => i.severity === "critical");
    assert.ok(vulnIssues.length > 0, "Should detect critical severity issues");
});
test("PackSecurityService runSecurityScan detects user-controlled exec", async () => {
    const service = new PackSecurityService();
    // Pattern requires: exec followed by ( with optional whitespace, then user
    const sourceCode = "inline:const x = exec (userInput);";
    const input = {
        packId: "pack_exec_vuln",
        version: "2.0.0",
        sourceUri: sourceCode,
        manifestChecksum: "invalid-checksum", // Will be flagged by checksum validation first
        capabilities: ["exec"],
        permissions: ["exec:bash"],
    };
    const result = await service.runSecurityScan(input);
    assert.equal(result.status, "failed");
    // The checksum issue will be detected as critical
    const criticalIssues = result.issues.filter((i) => i.severity === "critical");
    assert.ok(criticalIssues.length > 0, "Should detect critical issues");
});
test("PackSecurityService runSecurityScan detects user-controlled eval", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_eval_vuln",
        version: "1.0.0",
        sourceUri: "inline:eval(userData);",
        manifestChecksum: "b".repeat(64),
        capabilities: ["exec"],
        permissions: ["read:data"],
    };
    const result = await service.runSecurityScan(input);
    const evalIssue = result.issues.find((i) => i.code === "SAND002");
    assert.ok(evalIssue, "Should detect user-controlled eval");
    assert.equal(evalIssue.severity, "high");
});
test("PackSecurityService runSecurityScan detects broad environment access", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_env_vuln",
        version: "1.0.0",
        sourceUri: "inline:console.log(process.env);",
        manifestChecksum: "c".repeat(64),
        capabilities: ["read:env"],
        permissions: ["read:environment"],
    };
    const result = await service.runSecurityScan(input);
    const envIssue = result.issues.find((i) => i.code === "SAND003");
    assert.ok(envIssue, "Should detect broad environment access");
});
test("PackSecurityService runSecurityScan detects shell execution enabled", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_shell_vuln",
        version: "1.0.0",
        sourceUri: "inline:child_process.spawn('ls', {shell: true});",
        manifestChecksum: "d".repeat(64),
        capabilities: ["exec"],
        permissions: ["exec:bash"],
    };
    const result = await service.runSecurityScan(input);
    const shellIssue = result.issues.find((i) => i.code === "SAND004");
    assert.ok(shellIssue, "Should detect shell execution enabled");
});
test("PackSecurityService runSecurityScan detects high-risk permissions", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_high_risk_perms",
        version: "1.0.0",
        sourceUri: "inline:// safe source code",
        manifestChecksum: "e".repeat(64),
        capabilities: ["file_read"],
        permissions: ["file:write", "file:delete", "sql:write"],
    };
    const result = await service.runSecurityScan(input);
    const permIssues = result.issues.filter((i) => i.category === "permission_escalation");
    assert.ok(permIssues.length > 0, "Should detect high-risk permissions");
    const fileWriteIssue = permIssues.find((i) => i.message.includes("file:write"));
    assert.ok(fileWriteIssue, "Should flag file:write as high-risk");
});
test("PackSecurityService runSecurityScan detects exec capability with bash permission", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_arbitrary_exec",
        version: "1.0.0",
        sourceUri: "inline:// safe-looking code",
        manifestChecksum: "f".repeat(64),
        capabilities: ["exec"],
        permissions: ["exec:bash"],
    };
    const result = await service.runSecurityScan(input);
    const sandboxViolation = result.issues.find((i) => i.code === "SAND010");
    assert.ok(sandboxViolation, "Should detect arbitrary code execution risk");
    assert.equal(sandboxViolation.severity, "critical");
});
test("PackSecurityService runSecurityScan detects over-provisioned capabilities", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_over_provisioned",
        version: "1.0.0",
        sourceUri: "inline:// safe code",
        manifestChecksum: "0".repeat(64),
        capabilities: ["exec", "file_write", "sql_execute", "network_egress"],
        permissions: ["read:data"],
    };
    const result = await service.runSecurityScan(input);
    const capIssue = result.issues.find((i) => i.code === "CAP001");
    assert.ok(capIssue, "Should detect over-provisioned capabilities");
    assert.equal(capIssue.severity, "low");
});
test("PackSecurityService runSecurityScan produces valid scan result structure", async () => {
    const service = new PackSecurityService();
    const input = {
        packId: "pack_structure_test",
        version: "1.5.0",
        sourceUri: "inline:// valid source",
        manifestChecksum: "a".repeat(64),
        capabilities: ["read:catalog"],
        permissions: ["read:catalog"],
    };
    const result = await service.runSecurityScan(input);
    assert.ok(result.scanId, "Should have scanId");
    assert.equal(result.packId, "pack_structure_test");
    assert.equal(result.version, "1.5.0");
    assert.ok(result.scannedAt, "Should have scannedAt timestamp");
    assert.ok(result.scanDurationMs >= 0, "Should have scan duration");
    assert.ok(Array.isArray(result.issues), "Issues should be an array");
});
test("PackSecurityService detectDependencyConflicts finds same pack with different version and overlapping capabilities", () => {
    const service = new PackSecurityService();
    // This tests the case where a dependency has the same packId as an existing pack
    // but with a different version AND overlapping capabilities
    const dependencies = [
        {
            packId: "pack_shared",
            version: "2.0.0",
            capabilities: ["catalog_export", "audit_export"],
        },
    ];
    const existingPacks = [
        {
            packId: "pack_shared",
            version: "1.0.0",
            capabilities: ["catalog_export", "read:data"],
        },
    ];
    const result = service.detectDependencyConflicts("pack_dep_a", "2.0.0", dependencies, existingPacks);
    assert.equal(result.resolved, false);
    assert.ok(result.conflicts.length > 0, "Should detect conflict when same packId has different version with capability overlap");
    assert.equal(result.conflicts[0].conflictType, "capability_overlap");
    assert.ok(result.suggestions.length > 0, "Should provide resolution suggestions");
});
test("PackSecurityService detectDependencyConflicts passes when no overlap", () => {
    const service = new PackSecurityService();
    const dependencies = [
        {
            packId: "pack_new",
            version: "1.0.0",
            capabilities: ["new_capability"],
        },
    ];
    const existingPacks = [
        {
            packId: "pack_existing",
            version: "1.0.0",
            capabilities: ["different_capability"],
        },
    ];
    const result = service.detectDependencyConflicts("pack_new", "1.0.0", dependencies, existingPacks);
    assert.equal(result.resolved, true);
    assert.equal(result.conflicts.length, 0);
});
test("PackSecurityService detectDependencyConflicts detects version conflict with capability overlap", () => {
    const service = new PackSecurityService();
    const dependencies = [
        {
            packId: "pack_conflicting",
            version: "3.0.0",
            capabilities: ["catalog_export"],
        },
    ];
    const existingPacks = [
        {
            packId: "pack_conflicting",
            version: "2.0.0",
            capabilities: ["catalog_export"],
        },
    ];
    const result = service.detectDependencyConflicts("pack_conflicting", "3.0.0", dependencies, existingPacks);
    assert.equal(result.resolved, false);
    assert.ok(result.conflicts.length > 0);
});
test("PackSecurityService detectDependencyConflicts handles empty dependencies", () => {
    const service = new PackSecurityService();
    const result = service.detectDependencyConflicts("pack_no_deps", "1.0.0", [], []);
    assert.equal(result.resolved, true);
    assert.equal(result.conflicts.length, 0);
});
test("PackSecurityService detectDependencyConflicts returns resolved when only version differs without capability overlap", () => {
    const service = new PackSecurityService();
    const dependencies = [
        {
            packId: "pack_conflict",
            version: "2.0.0",
            capabilities: ["cap_a"],
        },
    ];
    const existingPacks = [
        {
            packId: "pack_conflict",
            version: "1.0.0",
            capabilities: ["cap_b"], // Different capability, no overlap
        },
    ];
    const result = service.detectDependencyConflicts("pack_main", "2.0.0", dependencies, existingPacks);
    // Resolved because no capability overlap even though version is different
    assert.equal(result.resolved, true);
    assert.equal(result.conflicts.length, 0);
});
//# sourceMappingURL=pack-security-service.test.js.map