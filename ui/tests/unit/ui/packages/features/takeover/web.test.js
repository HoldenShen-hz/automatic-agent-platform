import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockTakeoverCurrentTask = vi.fn(async () => undefined);
const mockAnnotateCurrentSnapshot = vi.fn();
const mockResumeAutomaticExecution = vi.fn(async () => undefined);
vi.mock("@aa/ui-core", () => ({
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    FeatureWorkbenchPanel: ({ items, actions }) => (_jsxs("div", { children: [items.map((item) => _jsx("div", { children: item.title }, item.title)), actions.map((action) => (_jsx("button", { type: "button", onClick: () => void action.onTrigger?.(), children: action.label }, action.id)))] })),
}));
vi.mock("../../../../../../packages/features/takeover/src/hooks", () => ({
    useTakeoverVm: () => ({
        items: [{ title: "Execution Snapshot", description: "Captured context" }],
        takeoverCurrentTask: mockTakeoverCurrentTask,
        annotateCurrentSnapshot: mockAnnotateCurrentSnapshot,
        resumeAutomaticExecution: mockResumeAutomaticExecution,
    }),
}));
import { TakeoverWebView } from "../../../../../../packages/features/takeover/src/web";
afterEach(() => {
    cleanup();
});
describe("TakeoverWebView", () => {
    it("wires takeover actions to executable handlers", () => {
        render(_jsx(TakeoverWebView, {}));
        fireEvent.click(screen.getByRole("button", { name: "接管当前任务" }));
        fireEvent.click(screen.getByRole("button", { name: "添加人工批注" }));
        fireEvent.click(screen.getByRole("button", { name: "恢复自动执行" }));
        expect(mockTakeoverCurrentTask).toHaveBeenCalledWith("web-operator");
        expect(mockAnnotateCurrentSnapshot).toHaveBeenCalledWith("manual-note", "web-operator");
        expect(mockResumeAutomaticExecution).toHaveBeenCalledWith("web-operator");
    });
});
