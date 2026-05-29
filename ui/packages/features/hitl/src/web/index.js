import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { FeatureScaffold, Inline, ListCard, Stack, designTokens } from "@aa/ui-core";
import { useHitlVm } from "../hooks";
export function HitlWebView() {
    const vm = useHitlVm();
    const [editorMode, setEditorMode] = useState(null);
    const [editorTargetId, setEditorTargetId] = useState(null);
    const [editorValue, setEditorValue] = useState("{}");
    const [editorError, setEditorError] = useState(null);
    async function applyEditor() {
        if (editorTargetId == null || editorMode == null) {
            return;
        }
        let parsed;
        try {
            const candidate = JSON.parse(editorValue);
            if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
                setEditorError("Editor payload must be a JSON object.");
                return;
            }
            parsed = candidate;
        }
        catch {
            setEditorError("Editor payload must be valid JSON.");
            return;
        }
        try {
            if (editorMode === "patch") {
                await vm.patch(editorTargetId, parsed);
            }
            else {
                await vm.override(editorTargetId, parsed);
            }
            setEditorError(null);
            setEditorMode(null);
            setEditorTargetId(null);
            setEditorValue("{}");
        }
        catch (error) {
            setEditorError(error instanceof Error ? error.message : String(error));
        }
    }
    return (_jsx(FeatureScaffold, { title: "HITL", summary: "\u4EBA\u5DE5\u4ECB\u5165\u3001Inspect\u3001Takeover\u3001Resume \u7684\u7EDF\u4E00\u5165\u53E3", status: "Implemented/Partial", children: _jsxs(Stack, { children: [_jsxs(Inline, { children: [_jsx("button", { disabled: vm.items.length === 0, onClick: () => {
                                void vm.bulkApprove(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
                            }, type: "button", children: "Bulk Approve" }), _jsx("button", { disabled: vm.items.length === 0, onClick: () => {
                                void vm.bulkReject(vm.items.filter((item) => item.type === "approval").map((item) => item.id));
                            }, type: "button", children: "Bulk Reject" })] }), _jsx(ListCard, { items: vm.items.map((item) => ({
                        title: item.title,
                        description: item.description,
                    })) }), vm.items.map((item) => (_jsxs("div", { style: { border: `1px solid ${designTokens.color.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }, children: [_jsxs("div", { children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.description }), item.secondsRemaining != null && _jsx("div", { children: `SLA: ${item.secondsRemaining}s remaining` }), item.escalationTarget != null && _jsx("div", { children: `Escalation: ${item.escalationTarget}` })] }), item.type === "approval" ? (_jsxs(Inline, { children: [_jsx("button", { onClick: () => { void vm.approve(item.id); }, type: "button", children: "Approve" }), _jsx("button", { onClick: () => { void vm.reject(item.id); }, type: "button", children: "Reject" }), _jsx("button", { onClick: () => {
                                        setEditorMode("patch");
                                        setEditorTargetId(item.id);
                                        setEditorError(null);
                                    }, type: "button", children: "Patch" }), _jsx("button", { onClick: () => {
                                        setEditorMode("override");
                                        setEditorTargetId(item.id);
                                        setEditorError(null);
                                    }, type: "button", children: "Override" })] })) : (_jsx("button", { onClick: () => { void vm.resume(item.id, "normal"); }, type: "button", children: "Resume" }))] }, item.id))), editorMode != null && (_jsx("form", { onSubmit: (event) => {
                        event.preventDefault();
                        void applyEditor();
                    }, children: _jsxs(Stack, { gap: 8, children: [_jsx("textarea", { onChange: (event) => setEditorValue(event.target.value), value: editorValue }), editorError != null ? _jsx("p", { role: "alert", children: editorError }) : null, _jsx("button", { type: "submit", children: "Apply" })] }) }))] }) }));
}
