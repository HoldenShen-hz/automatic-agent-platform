import { createFeatureModule } from "@aa/ui-core";
import { ConversationWebView } from "./web";

const conversationFeature = createFeatureModule({
  id: "conversation",
  title: "NL Conversation",
  group: "Extended",
  path: "/extended/conversation",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "NL 对话、追问和确认面板基线。",
  render: ConversationWebView,
});

export default conversationFeature;
export { createConversationMobileCards } from "./mobile";
export { useConversationVm } from "./hooks";
export { ConversationWebView } from "./web";
