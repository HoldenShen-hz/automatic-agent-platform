import { useMemo, useState } from "react";
import { ConversationClient } from "@aa/shared-nl-client";
import { FeatureScaffold, createFeatureModule } from "@aa/ui-core";

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

    return (
      <FeatureScaffold title="NL Conversation" summary="对话优先输入入口" status="Implemented/Partial">
        <button
          onClick={() => {
            client.send("帮我发起营销活动");
            client.pushAssistant("已创建任务草案，等待你确认预算和截止日期。");
            setMessages([...client.listMessages()]);
          }}
          type="button"
        >
          Send Sample Request
        </button>
        <ul>
          {messages.map((message) => (
            <li key={message.id}>
              <strong>{message.role}:</strong> {message.content}
            </li>
          ))}
        </ul>
      </FeatureScaffold>
    );
  },
});
