import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockAttachFiles = vi.fn();
const mockSendPrompt = vi.fn();
const mockBuildPlan = vi.fn();
const mockConfirmPlan = vi.fn();
const mockExecutePlan = vi.fn();
const mockRequestClarification = vi.fn();
const mockSetDraft = vi.fn();
vi.mock("@aa/ui-core", () => ({
    designTokens: {
        color: { border: "#d0d7de" },
    },
    CodeBlock: ({ code }) => _jsx("div", { children: `CODE:${code}` }),
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    FileAttachment: ({ files }) => (_jsx("div", { children: files.map((file) => _jsx("div", { children: `${file.name} ${file.sizeLabel}` }, file.name)) })),
    KeyValueTable: ({ rows }) => (_jsx("div", { children: rows.map((row) => _jsx("div", { children: `${row.key}: ${row.value}` }, row.key)) })),
}));
vi.mock("../../../../../../packages/features/conversation/src/hooks", () => ({
    useConversationVm: () => ({
        messages: [
            { role: "assistant", content: "```ts\nconst ok = true;\n```" },
            { role: "user", content: "plain text" },
        ],
        attachments: [{ id: "file-1", name: "brief.md", sizeLabel: "2 KB" }],
        status: "idle",
        draft: "ship it",
        planReady: true,
        executionReady: true,
        isStreaming: true,
        attachFiles: mockAttachFiles,
        setDraft: mockSetDraft,
        sendPrompt: mockSendPrompt,
        buildPlan: mockBuildPlan,
        confirmPlan: mockConfirmPlan,
        executePlan: mockExecutePlan,
        requestClarification: mockRequestClarification,
    }),
}));
import { ConversationWebView } from "../../../../../../packages/features/conversation/src/web";
afterEach(() => {
    cleanup();
});
describe("ConversationWebView", () => {
    it("renders streaming state, code blocks, and attachments", () => {
        render(_jsx(ConversationWebView, {}));
        expect(screen.queryByText(/Streaming: connected/)).not.toBeNull();
        expect(screen.queryByText("CODE:const ok = true;")).not.toBeNull();
        expect(screen.queryByText(/brief.md 2 KB/)).not.toBeNull();
    });
    it("wires draft, file attachment, and action buttons", () => {
        render(_jsx(ConversationWebView, {}));
        fireEvent.change(screen.getByDisplayValue("ship it"), { target: { value: "new prompt" } });
        fireEvent.change(screen.getByLabelText("Attach files"), {
            target: {
                files: [new File(["demo"], "notes.txt", { type: "text/plain" })],
            },
        });
        fireEvent.click(screen.getByRole("button", { name: "Send Prompt" }));
        fireEvent.click(screen.getByRole("button", { name: "Build Plan" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        fireEvent.click(screen.getByRole("button", { name: "Execute" }));
        fireEvent.click(screen.getByRole("button", { name: "Trigger Clarification" }));
        expect(mockSetDraft).toHaveBeenCalledWith("new prompt");
        expect(mockAttachFiles).toHaveBeenCalled();
        expect(mockSendPrompt).toHaveBeenCalled();
        expect(mockBuildPlan).toHaveBeenCalled();
        expect(mockConfirmPlan).toHaveBeenCalled();
        expect(mockExecutePlan).toHaveBeenCalled();
        expect(mockRequestClarification).toHaveBeenCalled();
    });
});
