import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { ConversationWebView } from "./web";

const featureCopy = translateFeatureCopy("conversation");

const conversationFeature = createFeatureModule({
  id: "conversation",
  title: featureCopy.title,
  group: "Mission Control",
  path: "/mission-control/conversation",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: ConversationWebView,
});

export default conversationFeature;
export { createConversationMobileCards } from "./mobile";
export { useConversationVm } from "./hooks";
export { ConversationWebView } from "./web";
