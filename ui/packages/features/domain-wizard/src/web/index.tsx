import { createElement, type ReactElement } from "react";
import { FeatureScaffold } from "@aa/ui-core";
import { useDomainWizardVm, type WizardStep } from "../hooks";

export function DomainWizardWebView(): ReactElement {
  const vm = useDomainWizardVm();

  const currentStepIndex = vm.steps.findIndex((s) => s.id === vm.currentStep);

  function goToStep(step: WizardStep) {
    vm.setCurrentStep(step);
  }

  function goNext() {
    const idx = currentStepIndex;
    if (idx < vm.steps.length - 1) {
      vm.setCurrentStep(vm.steps[idx + 1]!.id);
    }
  }

  function goPrev() {
    const idx = currentStepIndex;
    if (idx > 0) {
      vm.setCurrentStep(vm.steps[idx - 1]!.id);
    }
  }

  function renderStepper() {
    return createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "12px 16px", background: "var(--surface-elevated)", borderRadius: 8 } },
      vm.steps.map((step, index) => {
        const isActive = step.id === vm.currentStep;
        const isCompleted = index < currentStepIndex;
        const isClickable = index <= currentStepIndex || vm.selectedDomainId !== null || index === 0;
        return createElement(
          "div",
          { key: step.id, style: { display: "flex", alignItems: "center", gap: 8 } },
          createElement(
            "button",
            {
              onClick: () => isClickable && goToStep(step.id),
              disabled: !isClickable,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                cursor: isClickable ? "pointer" : "not-allowed",
                opacity: isClickable ? 1 : 0.5,
                background: isActive ? "var(--accent)" : isCompleted ? "var(--accent)" : "var(--border)",
                color: isActive || isCompleted ? "#04130a" : "var(--text)",
              },
            },
            isCompleted ? "✓" : index + 1,
          ),
          createElement(
            "span",
            {
              style: {
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-subtle)",
              },
            },
            step.label,
          ),
          index < vm.steps.length - 1
            ? createElement("div", { style: { flex: 1, height: 1, background: "var(--border)", minWidth: 24 } })
            : null,
        );
      }),
    );
  }

  function renderDomainSelectStep() {
    return createElement(
      "div",
      { style: { display: "grid", gap: 12 } },
      createElement("h3", { style: { margin: 0 } }, "选择领域"),
      createElement(
        "div",
        { style: { display: "grid", gap: 8 } },
        vm.items.length === 0
          ? createElement("p", { style: { color: "var(--text-subtle)" } }, "暂无可用领域")
          : vm.items.map((item, idx) =>
            createElement(
              "button",
              {
                key: idx,
                onClick: () => {
                  vm.setSelectedDomainId(`domain-${idx}`);
                  goNext();
                },
                style: {
                  padding: "12px 16px",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface)",
                  cursor: "pointer",
                },
              },
              createElement("strong", { style: { display: "block" } }, item.title),
              createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, item.description),
            ),
          ),
      ),
    );
  }

  function renderRiskProfileStep() {
    return createElement(
      "div",
      { style: { display: "grid", gap: 16 } },
      createElement("h3", { style: { margin: 0 } }, "风险配置"),
      createElement(
        "label",
        { style: { display: "grid", gap: 6 } },
        createElement("span", { style: { fontSize: 13, color: "var(--text-subtle)" } }, "风险等级"),
        createElement(
          "select",
          {
            value: vm.riskProfile.riskLevel,
            onChange: (e) => vm.riskProfile.setRiskLevel((e.target as HTMLSelectElement).value as typeof vm.riskProfile.riskLevel),
            style: { padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" },
          },
          createElement("option", { value: "low" }, "低风险"),
          createElement("option", { value: "medium" }, "中风险"),
          createElement("option", { value: "high" }, "高风险"),
          createElement("option", { value: "critical" }, "严重风险"),
        ),
      ),
      createElement(
        "label",
        { style: { display: "grid", gap: 6 } },
        createElement("span", { style: { fontSize: 13, color: "var(--text-subtle)" } }, "数据分类"),
        createElement(
          "select",
          {
            value: vm.riskProfile.dataClassification,
            onChange: (e) => vm.riskProfile.setDataClassification((e.target as HTMLSelectElement).value as typeof vm.riskProfile.dataClassification),
            style: { padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" },
          },
          createElement("option", { value: "public" }, "公开"),
          createElement("option", { value: "internal" }, "内部"),
          createElement("option", { value: "confidential" }, "机密"),
          createElement("option", { value: "restricted" }, "受限"),
        ),
      ),
      createElement(
        "label",
        { style: { display: "flex", gap: 8, alignItems: "center" } },
        createElement("input", {
          type: "checkbox",
          checked: vm.riskProfile.hasExternalIntegration,
          onChange: (e) => vm.riskProfile.setHasExternalIntegration((e.target as HTMLInputElement).checked),
        }),
        createElement("span", { fontSize: 13 }, "包含外部集成"),
      ),
    );
  }

  function renderCapabilityConfigStep() {
    return createElement(
      "div",
      { style: { display: "grid", gap: 16 } },
      createElement("h3", { style: { margin: 0 } }, "能力配置"),
      createElement(
        "label",
        { style: { display: "grid", gap: 6 } },
        createElement("span", { style: { fontSize: 13, color: "var(--text-subtle)" } }, "最大并发任务数"),
        createElement("input", {
          type: "number",
          min: 1,
          max: 50,
          value: vm.capabilityConfig.maxConcurrentTasks,
          onChange: (e) => vm.capabilityConfig.setMaxConcurrentTasks(Number((e.target as HTMLInputElement).value)),
          style: { padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" },
        }),
      ),
      createElement(
        "label",
        { style: { display: "grid", gap: 6 } },
        createElement("span", { style: { fontSize: 13, color: "var(--text-subtle)" } }, "允许的钻取深度"),
        createElement(
          "select",
          {
            value: vm.capabilityConfig.allowedDrillDepth,
            onChange: (e) => vm.capabilityConfig.setAllowedDrillDepth(Number((e.target as HTMLSelectElement).value) as typeof vm.capabilityConfig.allowedDrillDepth),
            style: { padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" },
          },
          createElement("option", { value: 1 }, "Level 1"),
          createElement("option", { value: 2 }, "Level 2"),
          createElement("option", { value: 3 }, "Level 3"),
          createElement("option", { value: 4 }, "Level 4"),
          createElement("option", { value: 5 }, "Level 5"),
        ),
      ),
      createElement(
        "label",
        { style: { display: "flex", gap: 8, alignItems: "center" } },
        createElement("input", {
          type: "checkbox",
          checked: vm.capabilityConfig.enableAutoRollback,
          onChange: (e) => vm.capabilityConfig.setEnableAutoRollback((e.target as HTMLInputElement).checked),
        }),
        createElement("span", { fontSize: 13 }, "启用自动回滚"),
      ),
    );
  }

  function renderReviewStep() {
    return createElement(
      "div",
      { style: { display: "grid", gap: 16 } },
      createElement("h3", { style: { margin: 0 } }, "审核确认"),
      createElement(
        "div",
        { style: { padding: 16, background: "var(--surface-elevated)", borderRadius: 8, display: "grid", gap: 12 } },
        createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 } },
          createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, "风险等级:"),
          createElement("strong", null, vm.riskProfile.riskLevel),
        ),
        createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 } },
          createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, "数据分类:"),
          createElement("strong", null, vm.riskProfile.dataClassification),
        ),
        createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 } },
          createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, "并发任务:"),
          createElement("strong", null, vm.capabilityConfig.maxConcurrentTasks),
        ),
        createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 } },
          createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, "钻取深度:"),
          createElement("strong", null, vm.capabilityConfig.allowedDrillDepth),
        ),
        createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 } },
          createElement("span", { style: { color: "var(--text-subtle)", fontSize: 13 } }, "自动回滚:"),
          createElement("strong", null, vm.capabilityConfig.enableAutoRollback ? "已启用" : "已禁用"),
        ),
      ),
    );
  }

  function renderCurrentStepContent() {
    switch (vm.currentStep) {
      case "domain-select":
        return renderDomainSelectStep();
      case "risk-profile":
        return renderRiskProfileStep();
      case "capability-config":
        return renderCapabilityConfigStep();
      case "review":
        return renderReviewStep();
    }
  }

  return (
    <FeatureScaffold title="Domain Wizard" summary="领域接入向导和 DomainUIConfig 驱动页面。" status="Implemented/Internal">
      {renderStepper()}
      <div style={{ padding: 16, background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
        {renderCurrentStepContent()}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        {currentStepIndex > 0 && (
          <button
            onClick={goPrev}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}
          >
            上一步
          </button>
        )}
        {currentStepIndex < vm.steps.length - 1 && (
          <button
            onClick={goNext}
            disabled={vm.currentStep === "domain-select" && vm.selectedDomainId === null}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent)",
              color: "#04130a",
              fontWeight: 600,
              cursor: vm.selectedDomainId === null ? "not-allowed" : "pointer",
              opacity: vm.selectedDomainId === null ? 0.5 : 1,
            }}
          >
            下一步
          </button>
        )}
        {vm.currentStep === "review" && (
          <button
            onClick={vm.submitConfig}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#04130a", fontWeight: 600, cursor: "pointer" }}
          >
            提交配置
          </button>
        )}
      </div>
    </FeatureScaffold>
  );
}
