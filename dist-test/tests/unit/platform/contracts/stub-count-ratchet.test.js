import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";
/**
 * Stub count ratchet guardian - SYS-QUAL-7.1
 *
 * Verifies that stub file count (files with <= 20 non-empty lines) does not increase.
 * Stub files indicate incomplete implementation - this test prevents new stubs from being added.
 */
const MAX_STUBS = 277; // Current stub count
test("[SYS-QUAL-7.1] stub file count does not increase", () => {
    const allFiles = globSync("src/**/*.ts", {
        ignore: ["**/*.d.ts", "**/node_modules/**", "**/index.ts"],
    });
    let stubCount = 0;
    const stubFiles = [];
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
        if (lines.length <= 20) {
            stubCount++;
            stubFiles.push(file);
        }
    }
    assert.ok(stubCount <= MAX_STUBS, `Stub count ${stubCount} exceeds ratchet ${MAX_STUBS} — new stubs not allowed. ` +
        `Files with <= 20 lines: ${stubCount}. ` +
        `First 10 stub files: ${stubFiles.slice(0, 10).join(", ")}`);
});
//# sourceMappingURL=stub-count-ratchet.test.js.map