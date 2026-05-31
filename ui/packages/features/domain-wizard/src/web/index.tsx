import type { ReactElement } from "react";
import { FeatureScaffold, Inline, Stack } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useDomainWizardVm, type DataClassification, type DomainWizardStepId, type RiskLevel } from "../hooks";

const stepHeadings: Record<DomainWizardStepId, string> = {
  "domain-select": "Domain Select",
  "risk-profile": "Risk Profile",
  "capability-config": "Capability Config",
  review: "Review",
};

export function DomainWizardWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("domain-wizard");
  const vm = useDomainWizardVm();
  const items = vm.items ?? vm.catalogItems ?? [];
  const previewRows = vm.previewRows ?? [];
  const validationErrors = vm.validationErrors ?? [];
  const currentStepLabel = vm.steps.find((step) => step.id === vm.currentStep)?.label ?? stepHeadings[vm.currentStep];

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (vm.currentStep === "review") {
            vm.submitConfig();
            return;
          }
          vm.goNext();
        }}
      >
      <Stack gap={16}>
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
          <h3>{currentStepLabel}</h3>
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
            {translateMessage("ui.domainWizard.form.riskLevel")}
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
            {translateMessage("ui.domainWizard.form.dataClassification")}
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
            {translateMessage("ui.domainWizard.form.externalIntegrations")}
          </label>
          <label>
            {translateMessage("ui.domainWizard.form.maxConcurrentTasks")}
            <input
              min={1}
              onChange={(event) => vm.capabilityConfig.setMaxConcurrentTasks(Number(event.target.value))}
              type="number"
              value={vm.capabilityConfig.maxConcurrentTasks}
            />
          </label>
          <label>
            {translateMessage("ui.domainWizard.form.allowedDrillDepth")}
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
            {translateMessage("ui.domainWizard.form.autoRollback")}
          </label>
        </section>

        <section>
          {previewRows.map((row) => (
            <div key={row.key}>{`${row.key}: ${row.value}`}</div>
          ))}
        </section>

        {validationErrors.length > 0 ? (
          <section aria-label={translateMessage("ui.domainWizard.validation.sectionLabel")}>
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

        <Inline>
          <button disabled={!vm.canGoBack} onClick={vm.goBack} type="button">{translateMessage("ui.domainWizard.back")}</button>
          <button disabled={!vm.canGoNext} type="submit">{vm.currentStep === "review" ? translateMessage("ui.domainWizard.submit") : translateMessage("ui.domainWizard.next")}</button>
        </Inline>
      </Stack>
      </form>
    </FeatureScaffold>
  );
}
