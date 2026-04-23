import { useMemo, useState } from "react";
import { ConversationClient, type ConversationStatus } from "@aa/shared-nl-client";
import { FeatureScaffold, KeyValueTable, ListCard, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "conversation",
  title: "NL Conversation",
  group: "Extended",
  path: "/extended/conversation",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "NL 对话、追问和确认面板基线。",
  render: () => {
    const client = useMemo(() => new ConversationClient(), []);
    const [messages, setMessages] = useState(client.listMessages());
    const [status, setStatus] = useState<ConversationStatus>(client.getStatus());

    return (
      <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                client.send("帮我发起营销活动");
                client.pushAssistant("已创建任务草案，等待你确认预算和截止日期。");
                setMessages([...client.listMessages()]);
                setStatus(client.getStatus());
              }}
              type="button"
            >
              Send Sample Request
            </button>
            <button
              onClick={() => {
                client.requestClarification("预算上限和投放时区还不清楚，请确认。");
                setMessages([...client.listMessages()]);
                setStatus(client.getStatus());
              }}
              type="button"
            >
              Trigger Clarification
            </button>
          </div>
          <KeyValueTable
            rows={[
              { key: "Conversation Status", value: status },
              { key: "Messages", value: String(messages.length) },
              { key: "Flow", value: "idle → parsing → clarifying → building → confirming → executing → reporting" },
            ]}
          />
          <ListCard
            items={messages.map((message) => ({
              title: `${message.role}`,
              description: message.content,
            }))}
          />
        </div>
      </FeatureScaffold>
    );
  },
});
