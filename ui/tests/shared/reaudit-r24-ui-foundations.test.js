import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureWorkbenchPanel } from "../../packages/ui-core/src/components";
import { designTokens } from "../../packages/ui-core/src/design-tokens";
import { ThreePaneLayout } from "../../packages/ui-core/src/layouts";
import { createDefaultTranslationService } from "../../packages/shared/i18n/src";
describe("R24 UI foundations", () => {
    it("lazy loads locale bundles, emits locale changes, and applies rtl document direction", async () => {
        const service = createDefaultTranslationService();
        const listener = vi.fn();
        const documentRef = { documentElement: { lang: "", dir: "" } };
        service.subscribe(listener);
        expect(service.translate("ui.notifications.pending", "zh-CN", "en-US", { count: 0 })).toBe("没有待处理项");
        expect(service.translate("ui.app.title", "ar-SA", "en-US")).toBe("Automatic Agent Platform UI");
        await service.loadLocale("ar-SA");
        service.setLocale("ar-SA", documentRef);
        expect(service.translate("ui.app.title", "ar-SA", "en-US")).toBe("منصة الوكيل الآلي");
        expect(documentRef.documentElement.lang).toBe("ar-SA");
        expect(documentRef.documentElement.dir).toBe("rtl");
        expect(listener).toHaveBeenCalledWith("ar-SA", "rtl");
        expect(service.listSupportedLocales().find((item) => item.locale === "ar-SA")?.direction).toBe("rtl");
    });
    it("exposes primitive-to-semantic tokens and canonical breakpoints", () => {
        expect(designTokens.primitive.color.slate050).toBe("#f8fafc");
        expect(designTokens.semantic.color.background).toBe(designTokens.primitive.color.slate050);
        expect(designTokens.semantic.color.surfaceSelected).toBeTruthy();
        expect(designTokens.breakpoints).toEqual({ mobile: 768, tablet: 1024, desktop: 1440 });
    });
    it("renders accessible workbench controls and responsive pane layout", () => {
        const { container } = render(_jsxs("div", { children: [_jsx(FeatureWorkbenchPanel, { items: [
                        { title: "Queue Review", description: "Triage incoming backlog" },
                        { title: "Policy Export", description: "Publish the governance digest" },
                    ], actions: [{ id: "run", label: "Run", tone: "accent" }], labels: {
                        filterLabel: "Filter items",
                        filterPlaceholder: "Filter queue",
                        activityLogTitle: "Recent activity",
                        activityLogEmpty: "No actions yet.",
                    } }), _jsx(ThreePaneLayout, { viewportWidth: 700, left: _jsx("div", { children: "Left" }), center: _jsx("div", { children: "Center" }), right: _jsx("div", { children: "Right" }) })] }));
        expect(screen.getByRole("searchbox", { name: "Filter items" })).toBeInTheDocument();
        expect(screen.getByRole("listbox", { name: "Workbench items" })).toBeInTheDocument();
        expect(screen.getByRole("log")).toBeInTheDocument();
        expect(screen.getByText("Recent activity")).toBeInTheDocument();
        const responsivePane = [...container.querySelectorAll("div")].find((element) => element.textContent?.includes("LeftCenterRight") && element.getAttribute("style")?.includes("align-items: start"));
        expect(responsivePane?.getAttribute("style")).toContain("grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))");
    });
});
