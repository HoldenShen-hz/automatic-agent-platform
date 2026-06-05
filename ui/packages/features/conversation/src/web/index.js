import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWsClient } from "@aa/shared-state";
import { CodeBlock, FeatureScaffold, FileAttachment, Inline, KeyValueTable, Stack, designTokens } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useConversationVm } from "../hooks";
function renderMessageContent(content) {
    const codeBlockMatch = content.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
    if (codeBlockMatch?.[1] != null) {
        return _jsx(CodeBlock, { code: codeBlockMatch[1] });
    }
    return _jsx("span", { children: content });
}
export function ConversationWebView() {
    const wsClient = useWsClient();
    const vm = useConversationVm(wsClient);
    const copy = translateFeatureCopy("conversation");
    const hasDraft = vm.draft.trim().length > 0;
    const hasPromptContext = hasDraft || vm.messages.some((message) => message.role === "user" && message.content.trim().length > 0);
    function handleFileAttach(event) {
        if (event.target.files == null) {
            return;
        }
        vm.attachFiles(event.target.files);
    }
    return (_jsx(FeatureScaffold, { title: copy.title, summary: copy.summary, status: "Implemented/Internal", children: _jsxs(Stack, { gap: 16, children: [_jsx("form", { onSubmit: (event) => {
                        event.preventDefault();
                        void vm.sendPrompt();
                    }, children: _jsxs(Inline, { children: [_jsx("input", { "aria-label": "Prompt", onChange: (event) => vm.setDraft(event.target.value), placeholder: "Ask the platform to plan or execute work", value: vm.draft }), !hasDraft ? (_jsx("button", { "aria-label": "Use Suggested Prompt", onClick: vm.restoreSuggestedDraft, type: "button", children: translateMessage("ui.conversation.useSuggestedPrompt") })) : null, _jsxs("label", { children: ["Attach files", _jsx("input", { "aria-label": "Attach files", onChange: handleFileAttach, style: { display: "none" }, type: "file", multiple: true })] }), _jsx("button", { "aria-label": "Send Prompt", disabled: !hasDraft, type: "submit", children: "Send Prompt" }), _jsx("button", { "aria-label": "Build Plan", disabled: !hasPromptContext, onClick: () => { void vm.buildPlan(); }, type: "button", children: "Build Plan" }), _jsx("button", { "aria-label": "Confirm", disabled: !vm.planReady, onClick: vm.confirmPlan, type: "button", children: "Confirm" }), _jsx("button", { "aria-label": "Execute", disabled: !vm.executionReady || vm.isExecuting, onClick: () => { void vm.executePlan(); }, type: "button", children: "Execute" }), _jsx("button", { "aria-label": "Trigger Clarification", onClick: vm.requestClarification, type: "button", children: "Trigger Clarification" })] }) }), _jsx("div", { children: `Streaming: ${vm.isStreaming ? "connected" : "idle"}` }), _jsx(KeyValueTable, { rows: [
                        { key: "Status", value: vm.status },
                        { key: "Messages", value: String(vm.messages.length) },
                        { key: "Plan Ready", value: String(vm.planReady) },
                        { key: "Execution Ready", value: String(vm.executionReady) },
                    ] }), vm.attachments.length > 0 && _jsx(FileAttachment, { files: vm.attachments }), _jsx(Stack, { children: vm.messages.map((message, index) => (_jsxs("div", { style: { border: `1px solid ${designTokens.color.border}`, borderRadius: 12, padding: 12 }, children: [_jsx("strong", { children: `${message.role} · ${index + 1}` }), _jsx("div", { children: renderMessageContent(message.content) })] }, message.id ?? `${message.role}-${index}`))) })] }) }));
}
