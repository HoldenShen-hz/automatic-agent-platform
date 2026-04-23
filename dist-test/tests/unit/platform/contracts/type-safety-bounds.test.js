import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";
/**
 * Type safety bounds guardian - SYS-QUAL-7.6
 *
 * Verifies that "as any" cast count does not increase over time.
 * "as any" bypasses TypeScript's type system and should be used sparingly.
 * This test acts as a ratchet - the count can only decrease, never increase.
 */
const CURRENT_AS_ANY_COUNT = 11; // Current count across the codebase
test("[SYS-QUAL-7.6] as-any cast count does not increase", () => {
    const files = globSync("src/**/*.ts", {
        ignore: ["**/*.d.ts", "**/node_modules/**"],
    });
    let total = 0;
    const details = [];
    for (const file of files) {
        const content = readFileSync(file, "utf8");
        // Match "as any" with word boundary (not "anyOf" or "anyhow")
        const matches = content.match(/as\s+any\b/g);
        if (matches) {
            const count = matches.length;
            total += count;
            details.push({ file, count });
        }
    }
    assert.ok(total <= CURRENT_AS_ANY_COUNT, `as-any count ${total} exceeds ratchet ${CURRENT_AS_ANY_COUNT}. ` +
        `Found ${total} occurrences across ${details.length} files. ` +
        `Details: ${details.map((d) => `${d.file} (${d.count})`).join(", ")}. ` +
        `Reduce usage or update CURRENT_AS_ANY_COUNT if removing is not feasible.`);
});
//# sourceMappingURL=type-safety-bounds.test.js.map