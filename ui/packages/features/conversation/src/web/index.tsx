import type { ChangeEvent, ReactElement } from "react";
import { CodeBlock, FeatureScaffold, FileAttachment, KeyValueTable } from "@aa/ui-core";
import { useConversationVm } from "../hooks";

function renderMessageContent(content: string): ReactElement {
  const codeBlockMatch = content.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (codeBlockMatch?.[1] != null) {
    return <CodeBlock code={codeBlockMatch[1]} />;
  }
  return <span>{content}</span>;
}

export function ConversationWebView(): ReactElement {
  const vm = useConversationVm();

  function handleFileAttach(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files == null) {
      return;
    }
    vm.attachFiles(event.target.files);
  }

  return (
    <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input onChange={(event) => vm.setDraft(event.target.value)} value={vm.draft} />
          <label>
            Attach files
            <input aria-label="Attach files" onChange={handleFileAttach} style={{ display: "none" }} type="file" multiple />
          </label>
          <button onClick={() => { void vm.sendPrompt(); }} type="button">Send Prompt</button>
          <button disabled={vm.messages.length === 0} onClick={() => { void vm.buildPlan(); }} type="button">Build Plan</button>
          <button disabled={!vm.planReady} onClick={vm.confirmPlan} type="button">Confirm</button>
          <button disabled={!vm.executionReady && vm.messages.length === 0} onClick={() => { void vm.executePlan(); }} type="button">Execute</button>
          <button onClick={vm.requestClarification} type="button">Trigger Clarification</button>
        </div>
        <KeyValueTable
          rows={[
            { key: "Conversation Status", value: vm.status },
            { key: "Messages", value: String(vm.messages.length) },
            { key: "Plan Ready", value: String(vm.planReady) },
            { key: "Execution Ready", value: String(vm.executionReady) },
            { key: "Streaming", value: vm.isStreaming ? "connected" : "idle" },
          ]}
        />
        {vm.attachments.length > 0 && <FileAttachment files={vm.attachments} />}
        <div style={{ display: "grid", gap: 12 }}>
          {vm.messages.map((message, index) => (
            <div key={message.id ?? `${message.role}-${index}`} style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
              <strong>{`${message.role} · ${index + 1}`}</strong>
              <div>{renderMessageContent(message.content)}</div>
            </div>
          ))}
        </div>
      </div>
    </FeatureScaffold>
  );
}
