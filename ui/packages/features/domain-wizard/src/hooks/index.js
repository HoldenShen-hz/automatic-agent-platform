import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDomainConfigsQuery } from "@aa/shared-state";
const STORAGE_KEY = "aa-domain-wizard-draft";
const orderedSteps = ["domain-select", "risk-profile", "capability-config", "review"];
const stepDescriptors = [
    { id: "domain-select", label: "选择域", description: "选择要配置的领域" },
    { id: "risk-profile", label: "风险配置", description: "设置风险等级和数据分类" },
    { id: "capability-config", label: "能力配置", description: "配置并发任务和钻取深度" },
    { id: "review", label: "审核确认", description: "审核并提交配置" },
];
function createDefaultDraft() {
    return {
        currentStep: "domain-select",
        selectedDomainId: null,
        riskLevel: "medium",
        dataClassification: "internal",
        hasExternalIntegration: false,
        maxConcurrentTasks: 5,
        allowedDrillDepth: 3,
        enableAutoRollback: true,
        savedAt: new Date(0).toISOString(),
    };
}
function readStoredDraft() {
    if (typeof window === "undefined") {
        return createDefaultDraft();
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
        return createDefaultDraft();
    }
    try {
        return validateStoredDraft(JSON.parse(raw));
    }
    catch {
        return createDefaultDraft();
    }
}
function normalizePositiveInt(value, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(1, Math.round(value));
}
export function useDomainWizardVm() {
    const stored = useMemo(readStoredDraft, []);
    const domains = useDomainConfigsQuery().data ?? [];
    const [currentStep, setCurrentStep] = useState(stored.currentStep);
    const [selectedDomainId, setSelectedDomainIdState] = useState(stored.selectedDomainId);
    const [riskLevel, setRiskLevel] = useState(stored.riskLevel);
    const [dataClassification, setDataClassification] = useState(stored.dataClassification);
    const [hasExternalIntegration, setHasExternalIntegration] = useState(stored.hasExternalIntegration);
    const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(stored.maxConcurrentTasks);
    const [allowedDrillDepth, setAllowedDrillDepth] = useState(stored.allowedDrillDepth);
    const [enableAutoRollback, setEnableAutoRollback] = useState(stored.enableAutoRollback);
    const [submissionMessage, setSubmissionMessage] = useState(null);
    const persistTimeoutRef = useRef(null);
    const items = useMemo(() => domains.map((domain) => ({
        title: domain.displayName,
        description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
    })), [domains]);
    const persist = useCallback((next = {}) => {
        if (typeof window === "undefined") {
            return;
        }
        const draft = {
            currentStep,
            selectedDomainId,
            riskLevel,
            dataClassification,
            hasExternalIntegration,
            maxConcurrentTasks,
            allowedDrillDepth,
            enableAutoRollback,
            savedAt: new Date().toISOString(),
            ...next,
        };
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        }
        catch {
            // Ignore browser storage failures and keep the in-memory draft authoritative.
        }
    }, [
        allowedDrillDepth,
        currentStep,
        dataClassification,
        enableAutoRollback,
        hasExternalIntegration,
        maxConcurrentTasks,
        riskLevel,
        selectedDomainId,
    ]);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (persistTimeoutRef.current != null) {
            clearTimeout(persistTimeoutRef.current);
        }
        persistTimeoutRef.current = setTimeout(() => {
            persist();
            persistTimeoutRef.current = null;
        }, 150);
        return () => {
            if (persistTimeoutRef.current != null) {
                clearTimeout(persistTimeoutRef.current);
                persistTimeoutRef.current = null;
            }
        };
    }, [persist]);
    const validationErrors = useMemo(() => {
        const errors = [];
        if (selectedDomainId == null) {
            errors.push("Select a domain before continuing.");
        }
        if (currentStep === "risk-profile" || currentStep === "review") {
            if (riskLevel === "critical" && dataClassification === "public") {
                errors.push("Critical domains cannot be marked public.");
            }
        }
        if (currentStep === "capability-config" || currentStep === "review") {
            if (maxConcurrentTasks < 1) {
                errors.push("Max concurrent tasks must be at least 1.");
            }
            if (allowedDrillDepth < 1 || allowedDrillDepth > 5) {
                errors.push("Allowed drill depth must stay between 1 and 5.");
            }
        }
        return errors;
    }, [allowedDrillDepth, currentStep, dataClassification, maxConcurrentTasks, riskLevel, selectedDomainId]);
    const currentIndex = orderedSteps.indexOf(currentStep);
    const applyDomainTemplate = useCallback((domainIdOrName) => {
        const template = domains.find((domain) => domain.id === domainIdOrName || domain.displayName === domainIdOrName);
        if (template == null) {
            return;
        }
        const nextSelectedId = template.id ?? domainIdOrName;
        setSelectedDomainIdState(nextSelectedId);
        setAllowedDrillDepth(template.defaultDrillDepth);
        persist({
            selectedDomainId: nextSelectedId,
            allowedDrillDepth: template.defaultDrillDepth,
        });
    }, [domains, persist]);
    const previewRows = useMemo(() => [
        { key: "Domain", value: selectedDomainId ?? "Unspecified" },
        { key: "Risk level", value: riskLevel },
        { key: "Data classification", value: dataClassification },
        { key: "External integrations", value: hasExternalIntegration ? "enabled" : "disabled" },
        { key: "Max concurrent tasks", value: String(maxConcurrentTasks) },
        { key: "Allowed drill depth", value: String(allowedDrillDepth) },
        { key: "Auto rollback", value: enableAutoRollback ? "enabled" : "disabled" },
    ], [allowedDrillDepth, dataClassification, enableAutoRollback, hasExternalIntegration, maxConcurrentTasks, riskLevel, selectedDomainId]);
    return {
        items,
        steps: stepDescriptors,
        currentStep,
        selectedDomainId,
        riskProfile: {
            riskLevel,
            dataClassification,
            hasExternalIntegration,
            setRiskLevel(value) {
                setRiskLevel(value);
                persist({ riskLevel: value });
            },
            setDataClassification(value) {
                setDataClassification(value);
                persist({ dataClassification: value });
            },
            setHasExternalIntegration(value) {
                setHasExternalIntegration(value);
                persist({ hasExternalIntegration: value });
            },
        },
        capabilityConfig: {
            maxConcurrentTasks,
            allowedDrillDepth,
            enableAutoRollback,
            setMaxConcurrentTasks(value) {
                const normalized = normalizePositiveInt(value, 1);
                setMaxConcurrentTasks(normalized);
                persist({ maxConcurrentTasks: normalized });
            },
            setAllowedDrillDepth(value) {
                const normalized = Math.min(5, normalizePositiveInt(value, 1));
                setAllowedDrillDepth(normalized);
                persist({ allowedDrillDepth: normalized });
            },
            setEnableAutoRollback(value) {
                setEnableAutoRollback(value);
                persist({ enableAutoRollback: value });
            },
        },
        catalogItems: items,
        previewRows,
        validationErrors,
        submissionMessage,
        canGoBack: currentIndex > 0,
        canGoNext: currentIndex < orderedSteps.length - 1 && validationErrors.length === 0,
        setCurrentStep(step) {
            setCurrentStep(step);
            persist({ currentStep: step });
        },
        setSelectedDomainId(domainId) {
            setSelectedDomainIdState(domainId);
            persist({ selectedDomainId: domainId });
            if (domainId != null) {
                applyDomainTemplate(domainId);
            }
        },
        goBack() {
            const previousStep = orderedSteps[Math.max(0, currentIndex - 1)] ?? "domain-select";
            setCurrentStep(previousStep);
            persist({ currentStep: previousStep });
        },
        goNext() {
            const nextStep = orderedSteps[Math.min(orderedSteps.length - 1, currentIndex + 1)] ?? "review";
            setCurrentStep(nextStep);
            persist({ currentStep: nextStep });
        },
        loadTemplate: applyDomainTemplate,
        submitConfig() {
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(STORAGE_KEY);
            }
            setSubmissionMessage("Domain configuration submitted");
        },
    };
}
function validateStoredDraft(value) {
    const fallback = createDefaultDraft();
    if (value == null || typeof value !== "object") {
        return fallback;
    }
    const parsed = value;
    return {
        currentStep: isStepId(parsed.currentStep) ? parsed.currentStep : fallback.currentStep,
        selectedDomainId: typeof parsed.selectedDomainId === "string" || parsed.selectedDomainId === null ? parsed.selectedDomainId : fallback.selectedDomainId,
        riskLevel: isRiskLevel(parsed.riskLevel) ? parsed.riskLevel : fallback.riskLevel,
        dataClassification: isDataClassification(parsed.dataClassification) ? parsed.dataClassification : fallback.dataClassification,
        hasExternalIntegration: typeof parsed.hasExternalIntegration === "boolean" ? parsed.hasExternalIntegration : fallback.hasExternalIntegration,
        maxConcurrentTasks: normalizePositiveInt(typeof parsed.maxConcurrentTasks === "number" ? parsed.maxConcurrentTasks : fallback.maxConcurrentTasks, fallback.maxConcurrentTasks),
        allowedDrillDepth: Math.min(5, normalizePositiveInt(typeof parsed.allowedDrillDepth === "number" ? parsed.allowedDrillDepth : fallback.allowedDrillDepth, fallback.allowedDrillDepth)),
        enableAutoRollback: typeof parsed.enableAutoRollback === "boolean" ? parsed.enableAutoRollback : fallback.enableAutoRollback,
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : fallback.savedAt,
    };
}
function isStepId(value) {
    return value === "domain-select" || value === "risk-profile" || value === "capability-config" || value === "review";
}
function isRiskLevel(value) {
    return value === "low" || value === "medium" || value === "high" || value === "critical";
}
function isDataClassification(value) {
    return value === "public" || value === "internal" || value === "confidential" || value === "restricted";
}
