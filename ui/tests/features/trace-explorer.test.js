import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import traceExplorer from "../../packages/features/trace-explorer/src/index";
describe("trace explorer feature", () => {
    it("renders the trace explorer contract", () => {
        render(_jsx(traceExplorer.Component, {}));
        expect(screen.getByText("Trace Explorer")).toBeInTheDocument();
        expect(screen.getByText("打开 Trace")).toBeInTheDocument();
        expect(screen.getByText("过滤受限事件")).toBeInTheDocument();
        expect(screen.getByText("导出追踪包")).toBeInTheDocument();
        expect(traceExplorer.route.path).toBe("/observability/trace-explorer");
        expect(traceExplorer.manifest.id).toBe("trace-explorer");
    });
});
