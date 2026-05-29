import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FeatureScaffold, Inline, Stack } from "@aa/ui-core";
import { useDomainWizardVm } from "../hooks";
const stepHeadings = {
    "domain-select": "Domain Select",
    "risk-profile": "Risk Profile",
    "capability-config": "Capability Config",
    review: "Review",
};
export function DomainWizardWebView() {
    const vm = useDomainWizardVm();
    const items = vm.items ?? vm.catalogItems ?? [];
    const previewRows = vm.previewRows ?? [];
    const validationErrors = vm.validationErrors ?? [];
    return (_jsx(FeatureScaffold, { title: "Domain Wizard", summary: "\u9886\u57DF\u63A5\u5165\u5411\u5BFC\u548C DomainUIConfig \u9A71\u52A8\u9875\u9762\u3002", status: "Implemented/Internal", children: _jsx("form", { onSubmit: (event) => {
                event.preventDefault();
                if (vm.currentStep === "review") {
                    vm.submitConfig();
                    return;
                }
                vm.goNext();
            }, children: _jsxs(Stack, { gap: 16, children: [_jsx("ol", { children: vm.steps.map((step) => (_jsxs("li", { children: [_jsx("button", { onClick: () => vm.setCurrentStep(step.id), type: "button", children: step.label }), _jsx("span", { children: ` · ${step.description}` })] }, step.id))) }), _jsxs("section", { children: [_jsx("h3", { children: stepHeadings[vm.currentStep] }), _jsx("div", { style: { display: "grid", gap: 12 }, children: items.map((item) => (_jsxs("button", { onClick: () => vm.setSelectedDomainId(item.title), style: { textAlign: "left" }, type: "button", children: [_jsx("strong", { children: item.title }), _jsx("div", { children: item.description })] }, item.title))) })] }), _jsxs("section", { style: { display: "grid", gap: 12 }, children: [_jsxs("label", { children: ["Risk level", _jsxs("select", { onChange: (event) => vm.riskProfile.setRiskLevel(event.target.value), value: vm.riskProfile.riskLevel, children: [_jsx("option", { value: "low", children: "low" }), _jsx("option", { value: "medium", children: "medium" }), _jsx("option", { value: "high", children: "high" }), _jsx("option", { value: "critical", children: "critical" })] })] }), _jsxs("label", { children: ["Data classification", _jsxs("select", { onChange: (event) => vm.riskProfile.setDataClassification(event.target.value), value: vm.riskProfile.dataClassification, children: [_jsx("option", { value: "public", children: "public" }), _jsx("option", { value: "internal", children: "internal" }), _jsx("option", { value: "confidential", children: "confidential" }), _jsx("option", { value: "restricted", children: "restricted" })] })] }), _jsxs("label", { children: [_jsx("input", { checked: vm.riskProfile.hasExternalIntegration, onChange: (event) => vm.riskProfile.setHasExternalIntegration(event.target.checked), type: "checkbox" }), "External integrations enabled"] }), _jsxs("label", { children: ["Max concurrent tasks", _jsx("input", { min: 1, onChange: (event) => vm.capabilityConfig.setMaxConcurrentTasks(Number(event.target.value)), type: "number", value: vm.capabilityConfig.maxConcurrentTasks })] }), _jsxs("label", { children: ["Allowed drill depth", _jsx("input", { max: 5, min: 1, onChange: (event) => vm.capabilityConfig.setAllowedDrillDepth(Number(event.target.value)), type: "number", value: vm.capabilityConfig.allowedDrillDepth })] }), _jsxs("label", { children: [_jsx("input", { checked: vm.capabilityConfig.enableAutoRollback, onChange: (event) => vm.capabilityConfig.setEnableAutoRollback(event.target.checked), type: "checkbox" }), "Enable auto rollback"] })] }), _jsx("section", { children: previewRows.map((row) => (_jsx("div", { children: `${row.key}: ${row.value}` }, row.key))) }), validationErrors.length > 0 ? (_jsx("section", { "aria-label": "Validation errors", children: validationErrors.map((error) => (_jsx("div", { children: error }, error))) })) : null, vm.submissionMessage == null ? null : (_jsx("section", { "aria-live": "polite", role: "status", children: vm.submissionMessage })), _jsxs(Inline, { children: [_jsx("button", { disabled: !vm.canGoBack, onClick: vm.goBack, type: "button", children: "Back" }), _jsx("button", { disabled: !vm.canGoNext, type: "submit", children: vm.currentStep === "review" ? "Submit" : "Next" })] })] }) }) }));
}
