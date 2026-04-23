import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("feature split structure", () => {
  it("keeps every feature package aligned to web/mobile/hooks", () => {
    const featureRoot = join(process.cwd(), "packages/features");
    const features = readdirSync(featureRoot).sort();

    expect(features.length).toBe(28);

    for (const feature of features) {
      const base = join(featureRoot, feature, "src");
      expect(existsSync(join(base, "hooks/index.ts")), `${feature} missing hooks/index.ts`).toBe(true);
      expect(existsSync(join(base, "mobile/index.ts")), `${feature} missing mobile/index.ts`).toBe(true);
      expect(existsSync(join(base, "web/index.tsx")), `${feature} missing web/index.tsx`).toBe(true);

      const rootIndex = readFileSync(join(base, "index.tsx"), "utf8");
      expect(rootIndex).toContain('from "./web"');
      expect(rootIndex).toContain('from "./hooks"');
      expect(rootIndex).toContain('from "./mobile"');
    }
  });
});
