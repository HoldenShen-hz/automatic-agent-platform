import { createFeatureModule } from "@aa/ui-core";
import { ConversationWebView } from "./web";

const conversationFeature = createFeatureModule({
  id: "conversation",
  title: "NL Conversation",
  group: "Mission Control",
  path: "/mission-control/conversation",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "NL 对话、追问、计划确认与执行闭环。",
  render: ConversationWebView,
});

export default conversationFeature;
export { createConversationMobileCards } from "./mobile";
export { useConversationVm } from "./hooks";
export { ConversationWebView } from "./web";
