import type { ChangeEvent, ReactElement } from "react";
import { CodeBlock, FeatureScaffold, FileAttachment, KeyValueTable } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
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
  const copy = translateFeatureCopy("conversation");

  function handleFileAttach(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files == null) {
      return;
    }
    vm.attachFiles(event.target.files);
  }

  return (
    <FeatureScaffold title={copy.title} summary={copy.summary} status={translateMessage("ui.conversation.status")}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            aria-label={translateMessage("ui.conversation.prompt.label")}
            onChange={(event) => vm.setDraft(event.target.value)}
            placeholder={translateMessage("ui.conversation.prompt.placeholder")}
            value={vm.draft}
          />
          <label>
            {translateMessage("ui.conversation.attachFiles")}
            <input aria-label={translateMessage("ui.conversation.attachFiles")} onChange={handleFileAttach} style={{ display: "none" }} type="file" multiple />
          </label>
          <button aria-label={translateMessage("ui.conversation.sendPrompt")} onClick={() => { void vm.sendPrompt(); }} type="button">{translateMessage("ui.conversation.sendPrompt")}</button>
          <button aria-label={translateMessage("ui.conversation.buildPlan")} disabled={vm.messages.length === 0} onClick={() => { void vm.buildPlan(); }} type="button">{translateMessage("ui.conversation.buildPlan")}</button>
          <button aria-label={translateMessage("ui.conversation.confirm")} disabled={!vm.planReady} onClick={vm.confirmPlan} type="button">{translateMessage("ui.conversation.confirm")}</button>
          <button aria-label={translateMessage("ui.conversation.execute")} disabled={!vm.executionReady && vm.messages.length === 0} onClick={() => { void vm.executePlan(); }} type="button">{translateMessage("ui.conversation.execute")}</button>
          <button aria-label={translateMessage("ui.conversation.triggerClarification")} onClick={vm.requestClarification} type="button">{translateMessage("ui.conversation.triggerClarification")}</button>
        </div>
        <KeyValueTable
          rows={[
            { key: translateMessage("ui.conversation.table.status"), value: vm.status },
            { key: translateMessage("ui.conversation.table.messages"), value: String(vm.messages.length) },
            { key: translateMessage("ui.conversation.table.planReady"), value: String(vm.planReady) },
            { key: translateMessage("ui.conversation.table.executionReady"), value: String(vm.executionReady) },
            { key: translateMessage("ui.conversation.table.streaming"), value: vm.isStreaming ? translateMessage("ui.conversation.streaming.connected") : translateMessage("ui.conversation.streaming.idle") },
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
