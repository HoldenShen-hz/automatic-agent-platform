import assert from "node:assert/strict";
import test from "node:test";
import { globSync } from "glob";
import { readFileSync } from "fs";
/**
 * Stub count ratchet guardian - SYS-QUAL-7.1
 *
 * Verifies that stub file count (files with <= 20 non-empty lines) does not increase.
 * Stub files indicate incomplete implementation - this test prevents new stubs from being added.
 */
const MAX_STUBS = 95;
const MAX_ORG_GOVERNANCE_STUB_RATIO = 0.05;
const MAX_SCALE_ECOSYSTEM_STUB_RATIO = 0.05;
function stripComments(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/g, ""))
        .join("\n");
}
function isCompatibilityFacade(content) {
    const normalized = stripComments(content)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
    if (normalized.length === 0) {
        return false;
    }
    const statements = normalized
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
    return statements.length > 0
        && statements.every((statement) => /^(export\s+\*\s+from\s+|export\s+\{[\s\S]*\}\s+from\s+|export\s+type\s+\{[\s\S]*\}\s+from\s+|import\s+type\s+\{[\s\S]*\}\s+from\s+)/.test(statement));
}
test("[SYS-QUAL-7.1] stub file count does not increase", () => {
    const allFiles = globSync("src/**/*.ts", {
        ignore: ["**/*.d.ts", "**/node_modules/**", "**/index.ts"],
    });
    let stubCount = 0;
    const stubFiles = [];
    let orgGovernanceFileCount = 0;
    let orgGovernanceStubCount = 0;
    let scaleEcosystemFileCount = 0;
    let scaleEcosystemStubCount = 0;
    for (const file of allFiles) {
        const content = readFileSync(file, "utf8");
        // Count non-empty, non-comment lines
        const lines = content.split("\n").filter((line) => {
            const trimmed = line.trim();
            // Skip empty lines
            if (!trimmed)
                return false;
            // Skip comment-only lines
            if (trimmed.startsWith("//"))
                return false;
            if (trimmed.startsWith("/*") || trimmed.startsWith("*"))
                return false;
            // Skip lines that are only comments
            if (trimmed === "*/")
                return false;
            return true;
        });
        if (file.startsWith("src/org-governance/")) {
            orgGovernanceFileCount++;
        }
        if (file.startsWith("src/scale-ecosystem/")) {
            scaleEcosystemFileCount++;
        }
        if (isCompatibilityFacade(content)) {
            continue;
        }
        if (lines.length <= 20) {
            stubCount++;
            stubFiles.push(file);
            if (file.startsWith("src/org-governance/")) {
                orgGovernanceStubCount++;
            }
            if (file.startsWith("src/scale-ecosystem/")) {
                scaleEcosystemStubCount++;
            }
        }
    }
    assert.ok(stubCount <= MAX_STUBS, `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed. ` +
        `Files with <= 20 lines: ${stubCount}. ` +
        `First 10 stub files: ${stubFiles.slice(0, 10).join(", ")}`);
    const orgGovernanceRatio = orgGovernanceStubCount / Math.max(orgGovernanceFileCount, 1);
    const scaleEcosystemRatio = scaleEcosystemStubCount / Math.max(scaleEcosystemFileCount, 1);
    assert.ok(orgGovernanceRatio <= MAX_ORG_GOVERNANCE_STUB_RATIO, `org-governance stub ratio ${(orgGovernanceRatio * 100).toFixed(1)}% exceeds ${(MAX_ORG_GOVERNANCE_STUB_RATIO * 100).toFixed(1)}%`);
    assert.ok(scaleEcosystemRatio <= MAX_SCALE_ECOSYSTEM_STUB_RATIO, `scale-ecosystem stub ratio ${(scaleEcosystemRatio * 100).toFixed(1)}% exceeds ${(MAX_SCALE_ECOSYSTEM_STUB_RATIO * 100).toFixed(1)}%`);
});
//# sourceMappingURL=stub-count-ratchet.test.js.map