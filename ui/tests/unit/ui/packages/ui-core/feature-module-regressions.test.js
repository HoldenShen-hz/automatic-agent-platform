import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as componentLibrary from "../../../../../packages/ui-core/src/components";
import { createFeatureModule } from "../../../../../packages/ui-core/src";
describe("ui-core feature module regressions", () => {
    it("wraps feature modules in a component error boundary", () => {
        const feature = createFeatureModule({
            id: "broken",
            title: "Broken",
            group: "Mission Control",
            path: "/broken",
            permission: "authenticated",
            status: "Implemented/Internal",
            summary: "broken feature",
            render() {
                throw new Error("render exploded");
            },
        });
        render(_jsx(feature.Component, {}));
        expect(screen.getByText("组件渲染失败")).toBeInTheDocument();
    });
    it("exports a component library beyond the original seven-component baseline", () => {
        const exportedComponents = Object.keys(componentLibrary).filter((key) => /^[A-Z]/.test(key));
        expect(exportedComponents.length).toBeGreaterThanOrEqual(10);
    });
});
