import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, Inline, Stack } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useDomainWizardVm } from "../hooks";
const stepHeadings = {
    "domain-select": "Domain Select",
    "risk-profile": "Risk Profile",
    "capability-config": "Capability Config",
    review: "Review",
};
export function DomainWizardWebView() {
    const featureCopy = translateFeatureCopy("domain-wizard");
    const vm = useDomainWizardVm();
    const items = vm.items ?? vm.catalogItems ?? [];
    const previewRows = vm.previewRows ?? [];
    const validationErrors = vm.validationErrors ?? [];
    const currentStepLabel = vm.steps.find((step) => step.id === vm.currentStep)?.label ?? stepHeadings[vm.currentStep];
    return (_jsx(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: _jsx("form", { onSubmit: async (event) => {
                event.preventDefault();
                if (vm.currentStep === "review") {
                    await vm.submitConfig();
                    return;
                }
                vm.goNext();
            }, children: _jsxs(Stack, { gap: 16, children: [_jsx("p", { style: { marginTop: 0 }, children: translateMessage("ui.domainWizard.boundary") }), _jsx("ol", { children: vm.steps.map((step) => (_jsxs("li", { children: [_jsx("button", { onClick: () => vm.setCurrentStep(step.id), type: "button", children: step.label }), _jsx("span", { children: ` · ${step.description}` })] }, step.id))) }), _jsxs("section", { children: [_jsx("h3", { children: currentStepLabel }), _jsx("div", { style: { display: "grid", gap: 12 }, children: items.map((item) => (_jsxs("button", { onClick: () => vm.setSelectedDomainId(item.id), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.description })] }, item.id))) })] }), _jsxs("section", { style: { display: "grid", gap: 12 }, children: [_jsxs("label", { children: [translateMessage("ui.domainWizard.form.riskLevel"), _jsxs("select", { onChange: (event) => vm.riskProfile.setRiskLevel(event.target.value), value: vm.riskProfile.riskLevel, children: [_jsx("option", { value: "low", children: "low" }), _jsx("option", { value: "medium", children: "medium" }), _jsx("option", { value: "high", children: "high" }), _jsx("option", { value: "critical", children: "critical" })] })] }), _jsxs("label", { children: [translateMessage("ui.domainWizard.form.dataClassification"), _jsxs("select", { onChange: (event) => vm.riskProfile.setDataClassification(event.target.value), value: vm.riskProfile.dataClassification, children: [_jsx("option", { value: "public", children: "public" }), _jsx("option", { value: "internal", children: "internal" }), _jsx("option", { value: "confidential", children: "confidential" }), _jsx("option", { value: "restricted", children: "restricted" })] })] }), _jsxs("label", { children: [_jsx("input", { checked: vm.riskProfile.hasExternalIntegration, onChange: (event) => vm.riskProfile.setHasExternalIntegration(event.target.checked), type: "checkbox" }), translateMessage("ui.domainWizard.form.externalIntegrations")] }), _jsxs("label", { children: [translateMessage("ui.domainWizard.form.maxConcurrentTasks"), _jsx("input", { min: 1, onChange: (event) => vm.capabilityConfig.setMaxConcurrentTasks(Number(event.target.value)), type: "number", value: vm.capabilityConfig.maxConcurrentTasks })] }), _jsxs("label", { children: [translateMessage("ui.domainWizard.form.allowedDrillDepth"), _jsx("input", { max: 5, min: 1, onChange: (event) => vm.capabilityConfig.setAllowedDrillDepth(Number(event.target.value)), type: "number", value: vm.capabilityConfig.allowedDrillDepth })] }), _jsxs("label", { children: [_jsx("input", { checked: vm.capabilityConfig.enableAutoRollback, onChange: (event) => vm.capabilityConfig.setEnableAutoRollback(event.target.checked), type: "checkbox" }), translateMessage("ui.domainWizard.form.autoRollback")] })] }), _jsx("section", { children: previewRows.map((row) => (_jsx("div", { children: `${row.key}: ${row.value}` }, row.key))) }), validationErrors.length > 0 ? (_jsx("section", { "aria-label": translateMessage("ui.domainWizard.validation.sectionLabel"), children: validationErrors.map((error) => (_jsx("div", { children: error }, error))) })) : null, vm.submissionMessage == null ? null : (_jsx("section", { "aria-live": "polite", role: "status", children: vm.submissionMessage })), _jsxs(Inline, { children: [_jsx("button", { disabled: !vm.canGoBack || vm.isSubmitting, onClick: vm.goBack, type: "button", children: translateMessage("ui.domainWizard.back") }), _jsx("button", { disabled: !vm.canGoNext, type: "submit", children: vm.currentStep === "review" ? translateMessage("ui.domainWizard.submit") : translateMessage("ui.domainWizard.next") })] })] }) }) }));
}
