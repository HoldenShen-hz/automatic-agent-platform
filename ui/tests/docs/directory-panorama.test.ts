import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ui directory panorama", () => {
  it("matches the key 3.4 directory panorama structure", () => {
    const root = process.cwd();
    const requiredPaths = [
      "packages/shared/api-client/src/types",
      "packages/shared/auth/src/auth-service.ts",
      "packages/shared/auth/src/token-manager.ts",
      "packages/shared/auth/src/session-guard.ts",
      "packages/shared/auth/src/types.ts",
      "packages/shared/state/src/stores",
      "packages/shared/state/src/queries",
      "packages/shared/state/src/query-client.ts",
      "packages/shared/sync/src/offline-queue.ts",
      "packages/shared/sync/src/conflict-resolver.ts",
      "packages/shared/sync/src/sync-coordinator.ts",
      "packages/shared/sync/src/types.ts",
      "packages/ui-core/src/design-tokens",
      "packages/ui-core/src/components",
      "packages/ui-core/src/charts",
      "packages/ui-core/src/layouts",
      "packages/ui-core/src/business",
      "packages/ui-core/src/themes",
      "packages/ui-mobile/src/components",
      "packages/ui-mobile/src/navigation",
      "packages/ui-mobile/src/native-modules",
      "packages/features/compliance/src/index.tsx",
      "docs/storybook/README.md",
      "docs/adr/README.md",
    ];

    for (const requiredPath of requiredPaths) {
      expect(existsSync(join(root, requiredPath))).toBe(true);
    }
  });
});
