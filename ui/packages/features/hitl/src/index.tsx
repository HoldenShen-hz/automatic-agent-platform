import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "hitl",
  title: "HITL",
  group: "Extended",
  path: "/extended/hitl",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "人工介入、Inspect、Takeover、Resume 的统一入口。",
});
