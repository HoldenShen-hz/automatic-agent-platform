import type { ReactElement, ReactNode } from "react";
import { CodeBlock, FeatureScaffold, FileAttachment, KeyValueTable } from "@aa/ui-core";
import { useConversationVm } from "../hooks";

function renderMessageContent(content: string): ReactNode {
  const blockMatch = content.match(/```(?:[\w-]+\n)?([\s\S]*?)```/);
  if (blockMatch == null) {
    return content;
  }
  return <CodeBlock code={blockMatch[1]?.trim() ?? ""} />;
}

export function ConversationWebView(): ReactElement {
  const vm = useConversationVm();

  return (
    <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input onChange={(event) => vm.setDraft(event.target.value)} value={vm.draft} />
          <input
            aria-label="Attach files"
            type="file"
            multiple
            onChange={(event) => {
              if (event.target.files != null) {
                vm.attachFiles(event.target.files);
              }
            }}
          />
          <button onClick={vm.sendPrompt} type="button">Send Prompt</button>
          <button disabled={vm.messages.length === 0} onClick={vm.buildPlan} type="button">Build Plan</button>
          <button disabled={!vm.planReady} onClick={vm.confirmPlan} type="button">Confirm</button>
          <button disabled={!vm.executionReady} onClick={vm.executePlan} type="button">Execute</button>
          <button onClick={vm.requestClarification} type="button">Trigger Clarification</button>
        </div>
        <KeyValueTable
          rows={[
            { key: "Conversation Status", value: vm.status },
            { key: "Messages", value: String(vm.messages.length) },
            { key: "Plan Ready", value: String(vm.planReady) },
            { key: "Execution Ready", value: String(vm.executionReady) },
            { key: "Streaming", value: vm.isStreaming ? "connected" : "offline" },
            { key: "Flow", value: "idle → parsing → clarifying → building → confirming → executing → reporting" },
          ]}
        />
        {vm.attachments.length > 0 && (
          <FileAttachment files={vm.attachments.map((attachment) => ({ ...attachment, kind: "queued file" }))} />
        )}
        <div style={{ display: "grid", gap: 12 }}>
          {vm.messages.map((message, index) => (
            <div key={`${message.role}-${index}`} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <strong>{message.role} · {index + 1}</strong>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{renderMessageContent(message.content)}</div>
            </div>
          ))}
        </div>
      </div>
    </FeatureScaffold>
  );
}
