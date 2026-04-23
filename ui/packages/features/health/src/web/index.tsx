import type { ReactElement } from "react";
import { FeatureScaffold, KeyValueTable } from "@aa/ui-core";
import { useHealthVm } from "../hooks";

export function HealthWebView(): ReactElement {
  const vm = useHealthVm();
  return (
    <FeatureScaffold title="Health" summary="健康状态与基础指标" status="Implemented/Contracted">
      <KeyValueTable rows={vm.rows} />
    </FeatureScaffold>
  );
}
