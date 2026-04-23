import { createFeatureModule } from "@aa/ui-core";
import { DispatchWebView } from "./web";

const dispatchFeature = createFeatureModule({
  id: "dispatch",
  title: "Dispatch",
  group: "Operations",
  path: "/operations/dispatch",
  permission: "platform_sre",
  status: "Implemented/Contracted",
  summary: "调度、执行和操作入口。",
  render: DispatchWebView,
});

export default dispatchFeature;
export { createDispatchMobileCards } from "./mobile";
export { useDispatchVm } from "./hooks";
export { DispatchWebView } from "./web";
