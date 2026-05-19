import type { ReactElement } from "react";
import { FeatureScaffold } from "@aa/ui-core";
import { useDomainWizardVm, type DataClassification, type DomainWizardStepId, type RiskLevel } from "../hooks";

const stepHeadings: Record<DomainWizardStepId, string> = {
  "domain-select": "Domain Select",
  "risk-profile": "Risk Profile",
  "capability-config": "Capability Config",
  review: "Review",
};

export function DomainWizardWebView(): ReactElement {
  const vm = useDomainWizardVm();
  const items = vm.items ?? vm.catalogItems ?? [];
  const previewRows = vm.previewRows ?? [];
  const validationErrors = vm.validationErrors ?? [];

  return (
    <FeatureScaffold title="Domain Wizard" summary="领域接入向导和 DomainUIConfig 驱动页面。" status="Implemented/Internal">
      <div style={{ display: "grid", gap: 16 }}>
        <ol>
          {vm.steps.map((step) => (
            <li key={step.id}>
              <button onClick={() => vm.setCurrentStep(step.id)} type="button">
                {step.label}
              </button>
              <span>{` · ${step.description}`}</span>
            </li>
          ))}
        </ol>

        <section>
          <h3>{stepHeadings[vm.currentStep]}</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item) => (
              <button
                key={item.title}
                onClick={() => vm.setSelectedDomainId(item.title)}
                style={{ textAlign: "left" }}
                type="button"
              >
                <strong>{item.title}</strong>
                <div>{item.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          <label>
            Risk level
            <select
              onChange={(event) => vm.riskProfile.setRiskLevel(event.target.value as RiskLevel)}
              value={vm.riskProfile.riskLevel}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label>
            Data classification
            <select
              onChange={(event) => vm.riskProfile.setDataClassification(event.target.value as DataClassification)}
              value={vm.riskProfile.dataClassification}
            >
              <option value="public">public</option>
              <option value="internal">internal</option>
              <option value="confidential">confidential</option>
              <option value="restricted">restricted</option>
            </select>
          </label>
          <label>
            <input
              checked={vm.riskProfile.hasExternalIntegration}
              onChange={(event) => vm.riskProfile.setHasExternalIntegration(event.target.checked)}
              type="checkbox"
            />
            External integrations enabled
          </label>
          <label>
            Max concurrent tasks
            <input
              min={1}
              onChange={(event) => vm.capabilityConfig.setMaxConcurrentTasks(Number(event.target.value))}
              type="number"
              value={vm.capabilityConfig.maxConcurrentTasks}
            />
          </label>
          <label>
            Allowed drill depth
            <input
              max={5}
              min={1}
              onChange={(event) => vm.capabilityConfig.setAllowedDrillDepth(Number(event.target.value))}
              type="number"
              value={vm.capabilityConfig.allowedDrillDepth}
            />
          </label>
          <label>
            <input
              checked={vm.capabilityConfig.enableAutoRollback}
              onChange={(event) => vm.capabilityConfig.setEnableAutoRollback(event.target.checked)}
              type="checkbox"
            />
            Enable auto rollback
          </label>
        </section>

        <section>
          {previewRows.map((row) => (
            <div key={row.key}>{`${row.key}: ${row.value}`}</div>
          ))}
        </section>

        {validationErrors.length > 0 ? (
          <section aria-label="Validation errors">
            {validationErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </section>
        ) : null}

        {vm.submissionMessage == null ? null : (
          <section aria-live="polite" role="status">
            {vm.submissionMessage}
          </section>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={!vm.canGoBack} onClick={vm.goBack} type="button">Back</button>
          <button disabled={!vm.canGoNext} onClick={vm.goNext} type="button">Next</button>
          <button onClick={vm.submitConfig} type="button">Submit</button>
        </div>
      </div>
    </FeatureScaffold>
  );
}
