import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("R24 UI source review", () => {
  it("wires lazy i18n loaders, locale listeners, and document direction updates", () => {
    const source = read("packages/shared/i18n/src/index.ts");
    expect(source).toContain("registerLoader");
    expect(source).toContain("subscribe(listener");
    expect(source).toContain("documentElement.dir");
  });

  it("adds realtime alert stream actions and operator history", () => {
    const source = read("packages/features/alerts/src/hooks/index.ts");
    expect(source).toContain('wsClient.subscribe("incidents"');
    expect(source).toContain("onSnooze");
    expect(source).toContain("onDismiss");
    expect(source).toContain("history");
  });

  it("implements a multi-step domain wizard with validation, persistence, and preview rows", () => {
    const source = read("packages/features/domain-wizard/src/hooks/index.ts");
    expect(source).toContain('"basics" | "policy" | "preview"');
    expect(source).toContain("localStorage");
    expect(source).toContain("validateDomainWizardDraft");
    expect(source).toContain("createPreviewRows");
  });

  it("ships real playwright smoke specs, openapi codegen, and an http mock server", () => {
    const e2eSource = read("tools/e2e/src/index.ts");
    const smokeSource = read("tools/e2e/src/smoke.spec.ts");
    const codegenSource = read("tools/codegen/src/index.ts");
    const mockServerSource = read("tools/mock-server/src/index.ts");

    expect(e2eSource).toContain('@playwright/test');
    expect(e2eSource).toContain("page.goto");
    expect(smokeSource).toContain("registerSmokeSuite");
    expect(codegenSource).toContain("generateBindingsFromOpenApi");
    expect(mockServerSource).toContain("createMockHttpServer");
    expect(mockServerSource).toContain("/healthz");
  });

  it("uses semantic design tokens, responsive breakpoints, and accessible workbench roles", () => {
    const tokenSource = read("packages/ui-core/src/design-tokens/index.ts");
    const layoutSource = read("packages/ui-core/src/layouts/index.ts");
    const componentSource = read("packages/ui-core/src/components/index.ts");

    expect(tokenSource).toContain("primitiveTokens");
    expect(tokenSource).toContain("semanticTokens");
    expect(tokenSource).toContain("mobile: 768");
    expect(layoutSource).toContain("viewportWidth");
    expect(layoutSource).toContain("gridTemplateColumns");
    expect(componentSource).toContain('role: "listbox"');
    expect(componentSource).toContain('role: "log"');
    expect(componentSource).not.toContain("#12201a");
  });

  it("persists settings through the preferences api, exposes api-key and notification settings, and restricts locale input to select options", () => {
    const hookSource = read("packages/features/settings/src/hooks/index.ts");
    const webSource = read("packages/features/settings/src/web/index.tsx");

    expect(hookSource).toContain('path: "/preferences"');
    expect(webSource).toContain("SettingsApiKeys");
    expect(webSource).toContain("SettingsNotifications");
    expect(webSource).toContain("<select onChange={(event) => vm.setDraftLocale(event.target.value)}");
    expect(webSource).not.toContain("<input onChange={(event) => vm.setDraftLocale(event.target.value)}");
  });
});
