import type { ChangeEvent, ReactElement } from "react";
import { useWsClient } from "@aa/shared-state";
import { CodeBlock, FeatureScaffold, FileAttachment, Inline, KeyValueTable, Stack, designTokens } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useConversationVm } from "../hooks";

function renderMessageContent(content: string): ReactElement {
  const codeBlockMatch = content.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (codeBlockMatch?.[1] != null) {
    return <CodeBlock code={codeBlockMatch[1]} />;
  }
  return <span>{content}</span>;
}

export function ConversationWebView(): ReactElement {
  const wsClient = useWsClient();
  const vm = useConversationVm(wsClient);
  const copy = translateFeatureCopy("conversation");

  function handleFileAttach(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files == null) {
      return;
    }
    vm.attachFiles(event.target.files);
  }

  return (
    <FeatureScaffold title={copy.title} summary={copy.summary} status="Implemented/Internal">
      <Stack gap={16}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void vm.sendPrompt();
          }}
        >
          <Inline>
          <input
            aria-label="Prompt"
            onChange={(event) => vm.setDraft(event.target.value)}
            placeholder="Ask the platform to plan or execute work"
            value={vm.draft}
          />
          <label>
            Attach files
            <input aria-label="Attach files" onChange={handleFileAttach} style={{ display: "none" }} type="file" multiple />
          </label>
          <button aria-label="Send Prompt" type="submit">Send Prompt</button>
          <button aria-label="Build Plan" disabled={vm.messages.length === 0} onClick={() => { void vm.buildPlan(); }} type="button">Build Plan</button>
          <button aria-label="Confirm" disabled={!vm.planReady} onClick={vm.confirmPlan} type="button">Confirm</button>
          <button aria-label="Execute" disabled={!vm.executionReady && vm.messages.length === 0} onClick={() => { void vm.executePlan(); }} type="button">Execute</button>
          <button aria-label="Trigger Clarification" onClick={vm.requestClarification} type="button">Trigger Clarification</button>
          </Inline>
        </form>
        <div>{`Streaming: ${vm.isStreaming ? "connected" : "idle"}`}</div>
        <KeyValueTable
          rows={[
            { key: "Status", value: vm.status },
            { key: "Messages", value: String(vm.messages.length) },
            { key: "Plan Ready", value: String(vm.planReady) },
            { key: "Execution Ready", value: String(vm.executionReady) },
          ]}
        />
        {vm.attachments.length > 0 && <FileAttachment files={vm.attachments} />}
        <Stack>
          {vm.messages.map((message, index) => (
            <div key={message.id ?? `${message.role}-${index}`} style={{ border: `1px solid ${designTokens.color.border}`, borderRadius: 12, padding: 12 }}>
              <strong>{`${message.role} · ${index + 1}`}</strong>
              <div>{renderMessageContent(message.content)}</div>
            </div>
          ))}
        </Stack>
      </Stack>
    </FeatureScaffold>
  );
}
