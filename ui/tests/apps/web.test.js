import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../apps/web/src/App";
import { featureRegistry } from "../../apps/web/src/feature-registry";
describe("web app", () => {
    afterEach(() => {
        cleanup();
    });
    it("renders the ui shell and default dashboard route", () => {
        render(_jsx(App, {}));
        const dashboardTitle = featureRegistry.find((feature) => feature.manifest.id === "dashboard")?.manifest.title;
        expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
        expect(dashboardTitle).toBeTruthy();
        expect(screen.getAllByText(dashboardTitle).length).toBeGreaterThan(0);
        expect(screen.getByText("WS")).toBeInTheDocument();
        expect(screen.getByText("Offline Queue")).toBeInTheDocument();
    });
});
