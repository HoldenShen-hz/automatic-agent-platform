import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";

/**
 * Zod boundary validation guardian - SYS-QUAL-7.3
 *
 * Verifies that all POST/PUT/PATCH route handlers call .parse() or .safeParse()
 * on their request body to validate input.
 */

const ROUTE_FILES = [
  "src/platform/interface/api/http-server/plane-routes.ts",
  "src/platform/interface/api/http-server/auth-routes.ts",
  "src/platform/interface/api/http-server/gateway-routes.ts",
  "src/platform/interface/api/http-server/approval-routes.ts",
  "src/platform/interface/api/http-server/billing-routes.ts",
  "src/platform/interface/api/http-server/console-routes.ts",
  "src/platform/interface/api/http-server/division-routes.ts",
  "src/platform/interface/api/http-server/dashboard-routes.ts",
  "src/platform/interface/api/http-server/task-routes.ts",
  "src/platform/interface/api/http-server/webhook-routes.ts",
  "src/platform/interface/api/http-server/admin-routes.ts",
  "src/platform/interface/api/http-server/cost-routes.ts",
  "src/platform/interface/api/http-server/incident-routes.ts",
  "src/platform/interface/api/http-server/pack-routes.ts",
  "src/platform/interface/api/http-server/prompt-routes.ts",
];

test("[SYS-QUAL-7.3] API route handlers call schema.parse on request body", () => {
  const violations: Array<{ file: string; handler: string }> = [];

  for (const file of ROUTE_FILES) {
    try {
      const content = readFileSync(file, "utf8");

      // Find all POST/PUT/PATCH route definitions
      // Match: { method: "POST", pathname: "/xxx", handler: (ctx) => { ...
      // We need to find handlers that don't have .parse() or .safeParse()

      // Split content into route blocks
      const routeBlockRegex = /\{\s*method:\s*"(POST|PUT|PATCH)",\s*pathname:[^,]*,?\s*handler:\s*\([^)]*\)\s*=>\s*\{/g;
      const blocks: Array<{ method: string; startIndex: number; endIndex: number }> = [];

      let match;
      while ((match = routeBlockRegex.exec(content)) !== null) {
        // Find the matching closing brace (simple heuristic for now)
        const startIdx = match.index;
        let openBraces = 1;
        let closeIdx = startIdx + match[0].length;
        let idx = closeIdx;

        while (idx < content.length && openBraces > 0) {
          if (content[idx] === "{" && content[idx - 1] !== "'" && content[idx - 1] !== '"') {
            openBraces++;
          } else if (content[idx] === "}" && content[idx - 1] !== "'" && content[idx - 1] !== '"') {
            openBraces--;
          }
          idx++;
          if (openBraces === 0) closeIdx = idx;
        }

        blocks.push({
          method: match[1] ?? "unknown",
          startIndex: startIdx,
          endIndex: closeIdx,
        });
      }

      for (const block of blocks) {
        const blockContent = content.substring(block.startIndex, block.endIndex);

        // Check if this handler has any .parse() or .safeParse() call
        const hasParse = /(\.parse\(|\.safeParse\()/.test(blockContent);
        const hasValidatedBodyReader = /readValidatedJsonBody\(/.test(blockContent);
        const hasValidationHelper = /\bparse[A-Z][A-Za-z0-9_]*\(/.test(blockContent);

        if (!hasParse && !hasValidatedBodyReader && !hasValidationHelper) {
          // Extract pathname for error message
          const pathnameMatch = blockContent.match(/pathname:\s*["']([^"']+)["']/);
          const pathname = pathnameMatch ? pathnameMatch[1] : "unknown";

          violations.push({
            file,
            handler: `${block.method} ${pathname}`,
          });
        }
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  assert.equal(
    violations.length,
    0,
    `${violations.length} route files have POST/PUT/PATCH handlers without .parse() validation: ` +
    violations.map((v) => `${v.file} (${v.handler})`).join(", "),
  );
});
