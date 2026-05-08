import { ConversationClient, type ConversationStatus } from "@aa/shared-nl-client";
import { useMemo, useState } from "react";

export interface ConversationVm {
  readonly messages: readonly { role: string; content: string }[];
  readonly status: ConversationStatus;
  readonly draft: string;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  setDraft(value: string): void;
  sendPrompt(): void;
  buildPlan(): void;
  confirmPlan(): void;
  executePlan(): void;
  requestClarification(): void;
}

export function useConversationVm(): ConversationVm {
  const client = useMemo(() => new ConversationClient(), []);
  const [messages, setMessages] = useState(client.listMessages());
  const [status, setStatus] = useState<ConversationStatus>(client.getStatus());
  const [draft, setDraft] = useState("帮我发起营销活动");
  const [planReady, setPlanReady] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);

  function syncState(nextPlanReady: boolean, nextExecutionReady: boolean): void {
    setMessages([...client.listMessages()]);
    setStatus(client.getStatus());
    setPlanReady(nextPlanReady);
    setExecutionReady(nextExecutionReady);
  }

  return {
    messages,
    status,
    draft,
    planReady,
    executionReady,
    setDraft(value: string) {
      setDraft(value);
    },
    sendPrompt() {
      client.send(draft);
      client.requestClarification("已解析请求，请确认预算上限、时区和投放窗口。");
      syncState(false, false);
    },
    buildPlan() {
      client.buildPlan("已生成执行计划：创建活动、拉取素材、等待审批、投放并回收指标。");
      client.confirm("计划已生成，是否确认进入执行？");
      syncState(true, false);
    },
    confirmPlan() {
      client.confirm("用户已确认计划，系统进入执行前检查。");
      syncState(planReady, true);
    },
    executePlan() {
      client.execute("任务已进入执行态，开始创建 campaign 并分配预算。");
      client.pushAssistant("执行完成：活动草案已创建，指标回传已接通。");
      syncState(true, true);
    },
    requestClarification() {
      client.requestClarification("预算上限和投放时区还不清楚，请确认。");
      syncState(planReady, executionReady);
    },
  };
}
