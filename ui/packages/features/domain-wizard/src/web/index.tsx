import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useDomainWizardVm } from "../hooks";

export function DomainWizardWebView(): ReactElement {
  const vm = useDomainWizardVm();
  return (
    <FeatureScaffold title="Domain Wizard" summary="领域接入向导和 DomainUIConfig 驱动页面。" status="Implemented/Internal">
      <ol>
        {vm.steps.map((step) => (
          <li key={step.id}>
            <strong>{step.title}</strong> - {step.status}
          </li>
        ))}
      </ol>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <label>
          Domain name
          <input value={vm.draft.displayName} onChange={(event) => vm.setField("displayName", event.target.value)} />
        </label>
        <label>
          Owner
          <input value={vm.draft.owner} onChange={(event) => vm.setField("owner", event.target.value)} />
        </label>
        <label>
          Drill depth
          <input
            max={5}
            min={1}
            type="number"
            value={vm.draft.drillDepth}
            onChange={(event) => vm.setField("drillDepth", Number(event.target.value))}
          />
        </label>
        <label>
          Visibility
          <select value={vm.draft.visibility} onChange={(event) => vm.setField("visibility", event.target.value as "private" | "shared" | "public")}>
            <option value="private">private</option>
            <option value="shared">shared</option>
            <option value="public">public</option>
          </select>
        </label>
        <label>
          Summary
          <textarea value={vm.draft.summary} onChange={(event) => vm.setField("summary", event.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={!vm.canGoBack} onClick={vm.goBack} type="button">Back</button>
          <button disabled={!vm.canGoNext} onClick={vm.goNext} type="button">Next</button>
        </div>
      </div>
      {vm.validationErrors.length > 0 ? (
        <ul>
          {vm.validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      <FeatureWorkbenchPanel
        items={vm.catalogItems}
        rows={vm.previewRows}
        actions={[
          { id: "domain-open", label: "进入配置向导", tone: "accent" },
          { id: "domain-validate", label: "校验显隐策略", tone: "neutral" },
          { id: "domain-checklist", label: "生成接入清单", tone: "neutral" },
          {
            id: "domain-apply-template",
            label: "套用选中域模板",
            tone: "accent",
            onTrigger: (item) => {
              if (item != null) {
                vm.loadTemplate(item.title);
              }
            },
          },
        ]}
      />
    </FeatureScaffold>
  );
}
