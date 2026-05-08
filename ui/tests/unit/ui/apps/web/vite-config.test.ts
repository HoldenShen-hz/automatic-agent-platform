import { describe, expect, it } from "vitest";

import viteConfig from "../../../../../apps/web/vite.config";

describe("web vite config", () => {
  it("enables hidden source maps for production builds", async () => {
    const config = await viteConfig({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe("hidden");
  });

  it("keeps source maps enabled outside production", async () => {
    const config = await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe(true);
  });
});
