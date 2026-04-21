export interface ProactiveTrigger {
    readonly triggerId: string;
    readonly kind: "schedule" | "event" | "signal";
    readonly expression: string;
}
export interface ProactiveAgentPort {
    registerTrigger(trigger: ProactiveTrigger): Promise<void>;
}
export type TriggerType = "schedule" | "event" | "threshold" | "webhook_inbound";
export interface ScheduleTriggerConfig {
    readonly cron: string;
    readonly timezone: string;
    readonly skipIfPreviousRunning: boolean;
}
export interface EventTriggerConfig {
    readonly eventSource: string;
    readonly eventPattern: string;
    readonly filter: Record<string, string>;
    readonly batchWindow?: string;
}
export interface ThresholdTriggerConfig {
    readonly metricSource: string;
    readonly metricName: string;
    readonly condition: "gt" | "lt" | "eq" | "change_rate_gt";
    readonly threshold: number;
    readonly evaluationWindow: string;
    readonly consecutiveBreaches: number;
}
export interface TriggerAction {
    readonly actionType: "create_task" | "create_goal" | "suggest_to_user" | "update_dashboard";
    readonly template: Record<string, unknown>;
    readonly requireConfirmation: boolean;
}
export interface TriggerDefinition {
    readonly triggerId: string;
    readonly domainId: string;
    readonly name: string;
    readonly type: TriggerType;
    readonly config: ScheduleTriggerConfig | EventTriggerConfig | ThresholdTriggerConfig;
    readonly action: TriggerAction;
    readonly enabled: boolean;
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly maxFireRate: string;
    readonly cooldown: string;
}
export interface TriggerEvaluationInput {
    readonly kind: "schedule" | "event" | "threshold" | "webhook_inbound";
    readonly now?: string;
    readonly event?: {
        source: string;
        name: string;
        payload?: Record<string, unknown>;
    };
    readonly metric?: {
        source: string;
        name: string;
        value: number;
        previousValue?: number;
    };
}
export interface TriggerFireDecision {
    readonly allowed: boolean;
    readonly reasonCodes: readonly string[];
    readonly actionMode: "auto_execute" | "suggest" | "silent_record";
    readonly queuedSuggestionId: string | null;
}
export interface ProactiveSuggestion {
    readonly suggestionId: string;
    readonly triggerId: string;
    readonly domainId: string;
    readonly createdAt: string;
    readonly title: string;
    readonly action: TriggerAction;
}
export interface ProactiveAgentServiceOptions {
    readonly declaredTriggerIdsByDomain?: Readonly<Record<string, readonly string[]>>;
    readonly maxConsecutiveFailures?: number;
    readonly dailyTriggerBudgetByDomain?: Readonly<Record<string, number>>;
}
export declare class ProactiveAgentService implements ProactiveAgentPort {
    private readonly states;
    private readonly suggestions;
    private readonly declaredTriggerIdsByDomain;
    private readonly maxConsecutiveFailures;
    private readonly dailyTriggerBudgetByDomain;
    private readonly dailyTriggerUsage;
    constructor(options?: ProactiveAgentServiceOptions);
    registerTrigger(trigger: ProactiveTrigger | TriggerDefinition): Promise<void>;
    listTriggers(domainId?: string): TriggerDefinition[];
    listSuggestions(domainId?: string): ProactiveSuggestion[];
    evaluate(triggerId: string, input: TriggerEvaluationInput): TriggerFireDecision;
    recordExecutionOutcome(triggerId: string, success: boolean): void;
    acknowledgeSuggestion(suggestionId: string): boolean;
    private matchesTrigger;
    private enqueueSuggestion;
}
