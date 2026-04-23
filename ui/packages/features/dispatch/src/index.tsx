import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "dispatch",
  title: "Dispatch",
  group: "Operations",
  path: "/operations/dispatch",
  permission: "platform_sre",
  status: "Implemented/Contracted",
  summary: "调度、执行和操作入口。",
});
