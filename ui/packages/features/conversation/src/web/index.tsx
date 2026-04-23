import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard } from "@aa/ui-core";
import { useConversationVm } from "../hooks";

export function ConversationWebView(): ReactElement {
  const vm = useConversationVm();

  return (
    <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input onChange={(event) => vm.setDraft(event.target.value)} value={vm.draft} />
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
            { key: "Flow", value: "idle → parsing → clarifying → building → confirming → executing → reporting" },
          ]}
        />
        <ListCard items={vm.messages.map((message, index) => ({ title: `${message.role} · ${index + 1}`, description: message.content }))} />
      </div>
    </FeatureScaffold>
  );
}
