import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard } from "@aa/ui-core";
import { useConversationVm } from "../hooks";

export function ConversationWebView(): ReactElement {
  const vm = useConversationVm();

  return (
    <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={vm.sendSample} type="button">Send Sample Request</button>
          <button onClick={vm.requestClarification} type="button">Trigger Clarification</button>
        </div>
        <KeyValueTable
          rows={[
            { key: "Conversation Status", value: vm.status },
            { key: "Messages", value: String(vm.messages.length) },
            { key: "Flow", value: "idle → parsing → clarifying → building → confirming → executing → reporting" },
          ]}
        />
        <ListCard items={vm.messages.map((message) => ({ title: message.role, description: message.content }))} />
      </div>
    </FeatureScaffold>
  );
}
