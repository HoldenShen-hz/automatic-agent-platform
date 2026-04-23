import { ConversationClient, type ConversationStatus } from "@aa/shared-nl-client";
import { useMemo, useState } from "react";

export interface ConversationVm {
  readonly messages: readonly { role: string; content: string }[];
  readonly status: ConversationStatus;
  sendSample(): void;
  requestClarification(): void;
}

export function useConversationVm(): ConversationVm {
  const client = useMemo(() => new ConversationClient(), []);
  const [messages, setMessages] = useState(client.listMessages());
  const [status, setStatus] = useState<ConversationStatus>(client.getStatus());

  return {
    messages,
    status,
    sendSample() {
      client.send("帮我发起营销活动");
      client.pushAssistant("已创建任务草案，等待你确认预算和截止日期。");
      setMessages([...client.listMessages()]);
      setStatus(client.getStatus());
    },
    requestClarification() {
      client.requestClarification("预算上限和投放时区还不清楚，请确认。");
      setMessages([...client.listMessages()]);
      setStatus(client.getStatus());
    },
  };
}
