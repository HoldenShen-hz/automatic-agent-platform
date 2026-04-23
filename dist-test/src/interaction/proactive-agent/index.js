import { newId, nowIso } from "../../platform/contracts/types/ids.js";
function parseDurationMs(raw) {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw.trim());
    if (!match) {
        return 0;
    }
    const value = Number(match[1]);
    switch (match[2]) {
        case "ms":
            return value;
        case "s":
            return value * 1000;
        case "m":
            return value * 60_000;
        case "h":
            return value * 3_600_000;
        case "d":
            return value * 86_400_000;
        default:
            return 0;
    }
}
function parseRateWindow(raw) {
    const match = /^(\d+)\/(hour|minute|day)$/.exec(raw.trim());
    if (!match) {
        return { max: Number.POSITIVE_INFINITY, windowMs: 0 };
    }
    return {
        max: Number(match[1]),
        windowMs: match[2] === "minute" ? 60_000 : match[2] === "day" ? 86_400_000 : 3_600_000,
    };
}
function toDefinition(trigger) {
    if ("type" in trigger) {
        return trigger;
    }
    return {
        triggerId: trigger.triggerId,
        domainId: "general_ops",
        name: trigger.triggerId,
        type: trigger.kind === "signal" ? "threshold" : trigger.kind,
        config: trigger.kind === "schedule"
            ? {
                cron: trigger.expression,
                timezone: "UTC",
                skipIfPreviousRunning: true,
            }
            : trigger.kind === "event"
                ? {
                    eventSource: "unknown",
                    eventPattern: trigger.expression,
                    filter: {},
                }
                : {
                    metricSource: "unknown",
                    metricName: trigger.expression,
                    condition: "gt",
                    threshold: 1,
                    evaluationWindow: "5m",
                    consecutiveBreaches: 1,
                },
        action: {
            actionType: "suggest_to_user",
            template: {},
            requireConfirmation: true,
        },
        enabled: true,
        riskLevel: "medium",
        maxFireRate: "10/hour",
        cooldown: "5m",
    };
}
export class ProactiveAgentService {
    states = new Map();
    suggestions = new Map();
    declaredTriggerIdsByDomain;
    maxConsecutiveFailures;
    dailyTriggerBudgetByDomain;
    dailyTriggerUsage = new Map();
    constructor(options = {}) {
        this.declaredTriggerIdsByDomain = options.declaredTriggerIdsByDomain ?? {};
        this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
        this.dailyTriggerBudgetByDomain = options.dailyTriggerBudgetByDomain ?? {};
    }
    async registerTrigger(trigger) {
        const definition = toDefinition(trigger);
        const declared = this.declaredTriggerIdsByDomain[definition.domainId];
        if (declared != null && !declared.includes(definition.triggerId)) {
            throw new Error(`proactive_agent.trigger_not_declared:${definition.domainId}:${definition.triggerId}`);
        }
        this.states.set(definition.triggerId, {
            trigger: definition,
            lastFiredAt: null,
            lastWindowStartedAt: null,
            firedInCurrentWindow: 0,
            consecutiveFailures: 0,
        });
    }
    listTriggers(domainId) {
        return [...this.states.values()]
            .map((entry) => entry.trigger)
            .filter((trigger) => domainId == null || trigger.domainId === domainId);
    }
    listSuggestions(domainId) {
        return [...this.suggestions.values()]
            .filter((item) => domainId == null || item.domainId === domainId)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    evaluate(triggerId, input) {
        const state = this.states.get(triggerId);
        if (state == null) {
            return { allowed: false, reasonCodes: ["proactive_agent.trigger_not_found"], actionMode: "silent_record", queuedSuggestionId: null };
        }
        const reasons = [];
        if (!state.trigger.enabled) {
            reasons.push("proactive_agent.trigger_disabled");
        }
        if (state.consecutiveFailures >= this.maxConsecutiveFailures) {
            reasons.push("proactive_agent.circuit_open");
        }
        const now = new Date(input.now ?? nowIso()).getTime();
        const dailyBudget = this.dailyTriggerBudgetByDomain[state.trigger.domainId];
        const usageKey = `${state.trigger.domainId}:${new Date(now).toISOString().slice(0, 10)}`;
        if (dailyBudget != null && (this.dailyTriggerUsage.get(usageKey) ?? 0) >= dailyBudget) {
            reasons.push("proactive_agent.domain_budget_exhausted");
        }
        const cooldownMs = parseDurationMs(state.trigger.cooldown);
        if (state.lastFiredAt != null && cooldownMs > 0 && now - new Date(state.lastFiredAt).getTime() < cooldownMs) {
            reasons.push("proactive_agent.cooldown_active");
        }
        const { max, windowMs } = parseRateWindow(state.trigger.maxFireRate);
        if (windowMs > 0) {
            if (state.lastWindowStartedAt == null || now - new Date(state.lastWindowStartedAt).getTime() >= windowMs) {
                state.lastWindowStartedAt = new Date(now).toISOString();
                state.firedInCurrentWindow = 0;
            }
            if (state.firedInCurrentWindow >= max) {
                reasons.push("proactive_agent.rate_limited");
            }
        }
        if (!this.matchesTrigger(state.trigger, input)) {
            reasons.push("proactive_agent.trigger_condition_not_met");
        }
        if (reasons.length > 0) {
            return {
                allowed: false,
                reasonCodes: reasons,
                actionMode: "silent_record",
                queuedSuggestionId: null,
            };
        }
        state.lastFiredAt = new Date(now).toISOString();
        state.firedInCurrentWindow += 1;
        if (dailyBudget != null) {
            this.dailyTriggerUsage.set(usageKey, (this.dailyTriggerUsage.get(usageKey) ?? 0) + 1);
        }
        const actionMode = state.trigger.action.requireConfirmation
            ? "suggest"
            : state.trigger.riskLevel === "critical"
                ? "silent_record"
                : state.trigger.action.actionType === "update_dashboard"
                    ? "silent_record"
                    : "auto_execute";
        const queuedSuggestionId = actionMode === "suggest" ? this.enqueueSuggestion(state.trigger) : null;
        return {
            allowed: true,
            reasonCodes: ["proactive_agent.fire_allowed"],
            actionMode,
            queuedSuggestionId,
        };
    }
    recordExecutionOutcome(triggerId, success) {
        const state = this.states.get(triggerId);
        if (state == null) {
            return;
        }
        state.consecutiveFailures = success ? 0 : state.consecutiveFailures + 1;
        if (!success && state.consecutiveFailures >= this.maxConsecutiveFailures) {
            state.trigger = {
                ...state.trigger,
                enabled: false,
            };
        }
    }
    acknowledgeSuggestion(suggestionId) {
        return this.suggestions.delete(suggestionId);
    }
    matchesTrigger(trigger, input) {
        if (trigger.type !== input.kind) {
            return false;
        }
        if (trigger.type === "event" || trigger.type === "webhook_inbound") {
            const config = trigger.config;
            return input.event?.source === config.eventSource
                && input.event.name.includes(config.eventPattern)
                && Object.entries(config.filter).every(([key, value]) => String(input.event?.payload?.[key] ?? "") === value);
        }
        if (trigger.type === "threshold") {
            const config = trigger.config;
            const metric = input.metric;
            if (metric == null || metric.source !== config.metricSource || metric.name !== config.metricName) {
                return false;
            }
            if (config.condition === "gt")
                return metric.value > config.threshold;
            if (config.condition === "lt")
                return metric.value < config.threshold;
            if (config.condition === "eq")
                return metric.value === config.threshold;
            if (metric.previousValue == null)
                return false;
            return Math.abs(metric.value - metric.previousValue) > config.threshold;
        }
        return true;
    }
    enqueueSuggestion(trigger) {
        const suggestionId = newId("suggestion");
        this.suggestions.set(suggestionId, {
            suggestionId,
            triggerId: trigger.triggerId,
            domainId: trigger.domainId,
            createdAt: nowIso(),
            title: `Suggestion from trigger ${trigger.name}`,
            action: trigger.action,
        });
        return suggestionId;
    }
}
//# sourceMappingURL=index.js.map