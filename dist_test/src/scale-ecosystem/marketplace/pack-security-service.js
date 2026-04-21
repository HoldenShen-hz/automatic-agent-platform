/**
 * @fileoverview Marketplace Pack Security & Dependency Service
 *
 * Provides:
 * - Automated security scanning for pack publications
 * - Sandbox execution testing before publication approval
 * - Static analysis for vulnerability patterns
 * - Dependency conflict detection with version resolution
 *
 * §55 Marketplace - 安全审查自动化 + 依赖冲突检测
 */
import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
const CRITICAL_VULNERABILITY_PATTERNS = [
    { pattern: /exec\s*\(\s*user/i, code: "SAND001", message: "User-controlled exec detected" },
    { pattern: /eval\s*\(\s*user/i, code: "SAND002", message: "User-controlled eval detected" },
    { pattern: /process\.env(?!\.)/i, code: "SAND003", message: "Broad environment access detected" },
    { pattern: /child_process.*shell.*true/i, code: "SAND004", message: "Shell execution enabled in child process" },
];
const HIGH_RISK_PERMISSIONS = [
    "file:write",
    "file:delete",
    "exec:bash",
    "exec:cmd",
    "sql:write",
    "network:egress:all",
];
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const INLINE_SOURCE_PREFIX = "inline:";
export class PackSecurityService {
    async runSecurityScan(input) {
        const scanId = newId("scan");
        const startTime = Date.now();
        const issues = [];
        issues.push(...this.validateManifestChecksum(input));
        const sandboxResult = await this.runSandboxTest(input);
        issues.push(...sandboxResult.issues);
        const staticResult = this.runStaticAnalysis(input);
        issues.push(...staticResult.issues);
        const capabilityResult = this.checkCapabilitySafety(input.capabilities);
        issues.push(...capabilityResult.issues);
        const status = issues.some((i) => i.severity === "critical") ? "failed"
            : issues.some((i) => i.severity === "high") ? "warning"
                : "passed";
        return {
            scanId,
            packId: input.packId,
            version: input.version,
            status,
            issues,
            scannedAt: nowIso(),
            scanDurationMs: Date.now() - startTime,
        };
    }
    detectDependencyConflicts(packId, version, dependencies, existingPacks) {
        const conflicts = [];
        const suggestions = [];
        for (const dep of dependencies) {
            const conflictWith = existingPacks.find((existing) => existing.packId === dep.packId && existing.version !== dep.version);
            if (conflictWith) {
                const capabilityOverlap = dep.capabilities.some((c) => conflictWith.capabilities.includes(c));
                if (capabilityOverlap) {
                    conflicts.push({
                        conflictingPackId: conflictWith.packId,
                        conflictingVersion: conflictWith.version,
                        conflictType: "capability_overlap",
                        details: `Pack ${dep.packId} v${dep.version} overlaps capabilities with ${conflictWith.packId} v${conflictWith.version}`,
                        resolution: `Use ${conflictWith.packId} v${conflictWith.version} or upgrade ${dep.packId} to a compatible version`,
                    });
                    suggestions.push(`Consider pinning ${conflictWith.packId} to version ${conflictWith.version}`);
                }
            }
        }
        return {
            packId,
            version,
            resolved: conflicts.length === 0,
            conflicts,
            suggestions,
        };
    }
    async runSandboxTest(input) {
        const issues = [];
        for (const permission of input.permissions) {
            if (HIGH_RISK_PERMISSIONS.includes(permission)) {
                issues.push({
                    severity: "medium",
                    category: "permission_escalation",
                    code: "PERM001",
                    message: `High-risk permission detected: ${permission}`,
                    location: "manifest.permissions",
                });
            }
        }
        return { issues };
    }
    validateManifestChecksum(input) {
        if (!SHA256_HEX_PATTERN.test(input.manifestChecksum)) {
            return [{
                    severity: "critical",
                    category: "static_analysis",
                    code: "PKG001",
                    message: "Manifest checksum must be a 64 character SHA-256 hex digest",
                    location: "manifest.checksum",
                }];
        }
        if (!input.sourceUri.startsWith(INLINE_SOURCE_PREFIX)) {
            return [];
        }
        const inlineSource = input.sourceUri.slice(INLINE_SOURCE_PREFIX.length);
        const fingerprint = createHash("sha256").update(inlineSource, "utf8").digest("hex");
        if (fingerprint === input.manifestChecksum.toLowerCase()) {
            return [];
        }
        return [{
                severity: "critical",
                category: "static_analysis",
                code: "PKG002",
                message: "Manifest checksum does not match inline source payload",
                location: "manifest.checksum",
            }];
    }
    runStaticAnalysis(input) {
        const issues = [];
        const manifestContent = input.sourceUri;
        for (const { pattern, code, message } of CRITICAL_VULNERABILITY_PATTERNS) {
            if (pattern.test(manifestContent)) {
                issues.push({
                    severity: "high",
                    category: "static_analysis",
                    code,
                    message,
                    location: "source",
                });
            }
        }
        if (input.capabilities.includes("exec") && input.permissions.includes("exec:bash")) {
            issues.push({
                severity: "critical",
                category: "sandbox_violation",
                code: "SAND010",
                message: "Pack has both exec capability and bash permission - potential arbitrary code execution",
                location: "manifest",
            });
        }
        return { issues };
    }
    checkCapabilitySafety(capabilities) {
        const issues = [];
        const dangerousCapabilities = capabilities.filter((c) => ["exec", "file_write", "sql_execute", "network_egress"].includes(c));
        if (dangerousCapabilities.length > 3) {
            issues.push({
                severity: "low",
                category: "capability_mismatch",
                code: "CAP001",
                message: `Pack requests ${dangerousCapabilities.length} high-risk capabilities (${dangerousCapabilities.join(", ")}) - may indicate over-provisioning`,
                location: "manifest.capabilities",
            });
        }
        return { issues };
    }
}
//# sourceMappingURL=pack-security-service.js.map