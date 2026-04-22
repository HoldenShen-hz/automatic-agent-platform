import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";

/**
 * No duplicate route registration guardian - SYS-QUAL-7.4
 *
 * Verifies that HTTP routes are not registered twice in route files.
 * Duplicate routes cause ambiguity and can lead to unpredictable behavior.
 */

const ROUTE_FILES = [
  "src/platform/interface/api/http-server/plane-routes.ts",
  "src/platform/interface/api/http-server/health-routes.ts",
  "src/platform/interface/api/http-server/auth-routes.ts",
  "src/platform/interface/api/http-server/gateway-routes.ts",
  "src/platform/interface/api/http-server/approval-routes.ts",
  "src/platform/interface/api/http-server/billing-routes.ts",
  "src/platform/interface/api/http-server/console-routes.ts",
  "src/platform/interface/api/http-server/division-routes.ts",
  "src/platform/interface/api/http-server/metrics-routes.ts",
  "src/platform/interface/api/http-server/dashboard-routes.ts",
  "src/platform/interface/api/http-server/task-routes.ts",
  "src/platform/interface/api/http-server/webhook-routes.ts",
  "src/platform/interface/api/http-server/admin-routes.ts",
  "src/platform/interface/api/http-server/cost-routes.ts",
  "src/platform/interface/api/http-server/incident-routes.ts",
  "src/platform/interface/api/http-server/pack-routes.ts",
  "src/platform/interface/api/http-server/prompt-routes.ts",
];

test("[SYS-QUAL-7.4] no duplicate route registration in any route file", () => {
  const allViolations: Array<{ file: string; duplicates: string[] }> = [];

  for (const routeFile of ROUTE_FILES) {
    try {
      const content = readFileSync(routeFile, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      const routeKeys = Array.from(
        content.matchAll(/method:\s*["']([A-Z]+)["'],\s*\n\s*pathname:\s*["']([^"']+)["']/g),
        (match) => `${match[1]} ${match[2]}`,
      );

      // Find duplicates
      const seen = new Set<string>();
      const duplicates: string[] = [];

      for (const routeKey of routeKeys) {
        if (seen.has(routeKey)) {
          if (!duplicates.includes(routeKey)) {
            duplicates.push(routeKey);
          }
        }
        seen.add(routeKey);
      }

      if (duplicates.length > 0) {
        allViolations.push({ file: routeFile, duplicates });
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  assert.equal(
    allViolations.length,
    0,
    `Duplicate route registrations found:\n${allViolations.map((v) => `${v.file}: duplicates [${v.duplicates.join(", ")}]`).join("\n")}`,
  );
});
