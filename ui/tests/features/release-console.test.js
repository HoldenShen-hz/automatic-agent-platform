import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import releaseConsole from "../../packages/features/release-console/src/index";
describe("release console feature", () => {
    it("renders the release console contract", () => {
        render(_jsx(releaseConsole.Component, {}));
        expect(screen.getByText("Release Console")).toBeInTheDocument();
        expect(screen.getByText("运行门禁")).toBeInTheDocument();
        expect(screen.getByText("推进灰度")).toBeInTheDocument();
        expect(screen.getByText("查看回滚计划")).toBeInTheDocument();
        expect(releaseConsole.route.path).toBe("/operations/release-console");
        expect(releaseConsole.manifest.id).toBe("release-console");
    });
});
