export { detectAmbiguity } from "./ambiguity-handler/index.js";
export * from "./disambiguation-handler/index.js";
export * from "./intent-parser/index.js";
export * from "./slot-resolver/index.js";
import { loadNlGatewayConfig, getConversationWindowSize, shouldRequestClarification, } from "./nl-gateway-config-loader.js";
export { loadNlGatewayConfig, getConversationWindowSize, shouldRequestClarification, } from "./nl-gateway-config-loader.js";
import { IntakeRouter } from "../../platform/orchestration/routing/intake-router.js";
import { createPlatformPrincipal, createRequestEnvelope, } from "../../platform/contracts/types/index.js";
const DEFAULT_LOCALE_CONFIG = {
    supportedLocales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    localeResolutionOrder: ["user_profile", "accept_language", "input_detect", "default"],
};
const GENERIC_AMBIGUOUS_PATTERNS = [
    "做一份报表",
    "处理一下",
    "看一下",
    "帮我处理",
    "帮我做",
    "做一个",
    "optimize this",
    "handle it",
    "fix this",
    "do the report",
];
const HIGH_RISK_KEYWORDS = [
    "delete",
    "drop",
    "remove",
    "erase",
    "purge",
    "deploy",
    "release",
    "publish",
    "approve",
    "price",
    "production",
    "prod",
    "删除",
    "清理",
    "下线",
    "发布",
    "上线",
    "审批",
    "价格",
    "生产环境",
];
const CRITICAL_RISK_KEYWORDS = [
    "delete production",
    "drop table",
    "mass delete",
    "delete all",
    "删除全部",
    "删除生产",
    "清空",
];
const IRREVERSIBLE_KEYWORDS = [
    "delete",
    "drop",
    "erase",
    "remove",
    "删除",
    "清空",
    "覆盖",
];
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const PERCENT_PATTERN = /\b\d+(?:\.\d+)?%\b/g;
const CURRENCY_PATTERN = /(?:¥|\$|￥)\s?\d+(?:\.\d+)?/g;
const ENV_PATTERN = /\b(prod|production|staging|stage|dev|test|线上|生产环境|测试环境)\b/gi;
const CHANNEL_PATTERN = /\b(slack|telegram|webhook|email|api)\b/gi;
function detectInputLocale(message) {
    if (/[\u4e00-\u9fff]/.test(message)) {
        return "zh-CN";
    }
    if (/[\u3040-\u30ff]/.test(message)) {
        return "ja-JP";
    }
    if (/[äöüß]/i.test(message)) {
        return "de-DE";
    }
    if (/[a-z]/i.test(message)) {
        return "en-US";
    }
    return null;
}
function parseAcceptLanguage(raw) {
    if (raw == null || raw.trim().length === 0) {
        return [];
    }
    return raw
        .split(",")
        .map((item) => item.trim().split(";")[0]?.trim())
        .filter((item) => Boolean(item && item.length > 0));
}
function mapIntentType(intent) {
    switch (intent) {
        case "create":
            return "task_create";
        case "modify":
        case "cancel":
        case "correction":
            return "task_modify";
        case "approve":
            return "approval_action";
        case "clarify":
        case "chitchat":
            return "status_inquiry";
        default:
            return "task_query";
    }
}
function deriveUrgency(message) {
    const normalized = message.toLowerCase();
    if (/(asap|immediately|urgent|critical|立刻|马上|紧急|尽快)/.test(normalized)) {
        return "high";
    }
    if (/(today|before|今晚|今天|本周)/.test(normalized)) {
        return "normal";
    }
    return "low";
}
function deriveTitle(message) {
    const compact = message.replace(/\s+/g, " ").trim();
    if (compact.length <= 60) {
        return compact;
    }
    return `${compact.slice(0, 57)}...`;
}
function dedupeEntities(entities) {
    const seen = new Set();
    const result = [];
    for (const entity of entities) {
        const key = `${entity.entityType}:${entity.value}:${JSON.stringify(entity.normalized)}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(entity);
    }
    return result;
}
function collectRegexEntities(message, pattern, entityType, normalizeValue) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const entities = [];
    for (const match of message.matchAll(regex)) {
        const value = match[0];
        if (value == null || match.index == null) {
            continue;
        }
        entities.push({
            entityType,
            value,
            normalized: normalizeValue?.(value) ?? value,
            sourceSpan: [match.index, match.index + value.length],
        });
    }
    return entities;
}
function extractEntities(message) {
    const entities = [
        ...collectRegexEntities(message, DATE_PATTERN, "date", (value) => value),
        ...collectRegexEntities(message, PERCENT_PATTERN, "percentage", (value) => Number.parseFloat(value.replace("%", "")) / 100),
        ...collectRegexEntities(message, CURRENCY_PATTERN, "money", (value) => Number.parseFloat(value.replace(/[^\d.]/g, ""))),
        ...collectRegexEntities(message, ENV_PATTERN, "environment", (value) => value.toString().toLowerCase()),
        ...collectRegexEntities(message, CHANNEL_PATTERN, "channel", (value) => value.toString().toLowerCase()),
    ];
    return dedupeEntities(entities);
}
function defaultCostEstimate() {
    return {
        estimatedCostUsd: 0.05,
        confidence: "default",
        sampleCount: 0,
        divisionId: null,
        basedOn: "default",
    };
}
function buildClarificationQuestions(message, confidence, divisionId, entities) {
    const questions = [];
    const normalized = message.toLowerCase();
    if (confidence < 0.7) {
        questions.push("你希望我先查询现状、创建新任务，还是修改已有内容？");
    }
    if (GENERIC_AMBIGUOUS_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        questions.push("请补充更具体的范围，例如业务域、时间区间或目标对象。");
    }
    if (divisionId === "general_ops" && /(报表|report|campaign|广告|合同|招聘|deploy|release|代码|bug)/i.test(message)) {
        questions.push("这是哪个业务域的请求？例如工程、营销、法务或 HR。");
    }
    if (entities.length === 0 && /(modify|update|delete|修改|更新|删除|deploy|release|发布)/i.test(message)) {
        questions.push("请指出具体对象或环境，避免误操作。");
    }
    return questions;
}
function buildRiskPreview(message, intentType) {
    const normalized = message.toLowerCase();
    const critical = CRITICAL_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const high = HIGH_RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const irreversible = IRREVERSIBLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const riskFactors = [];
    const sideEffects = [];
    if (critical) {
        riskFactors.push("请求涉及破坏性或生产级变更");
    }
    else if (high) {
        riskFactors.push("请求可能影响线上系统、审批流或成本");
    }
    if (intentType === "approval_action") {
        riskFactors.push("请求属于审批类动作，需要审计和责任链");
    }
    if (/(budget|cost|费用|预算|price|价格)/i.test(message)) {
        sideEffects.push("可能改变成本或预算分配");
    }
    if (/(deploy|release|publish|发布|上线)/i.test(message)) {
        sideEffects.push("可能影响运行中的环境或用户体验");
    }
    if (/(delete|drop|remove|删除|清空)/i.test(message)) {
        sideEffects.push("可能移除已有数据或配置");
    }
    return {
        overallRisk: critical ? "critical" : high ? "high" : intentType === "task_modify" ? "medium" : "low",
        riskFactors,
        reversible: !irreversible,
        sideEffects,
        approvalNeeded: critical || high || intentType === "approval_action",
    };
}
export class NlEntryService {
    intakeRouter;
    costEstimator;
    clarificationThreshold;
    localeConfig;
    conversationWindowSize;
    nlConfig;
    constructor(options = {}) {
        this.intakeRouter = options.intakeRouter ?? new IntakeRouter();
        this.costEstimator = options.costEstimator ?? null;
        this.clarificationThreshold = options.clarificationThreshold ?? 0.7;
        this.localeConfig = options.localeConfig ?? DEFAULT_LOCALE_CONFIG;
        this.nlConfig = options.nlGatewayConfig ?? loadNlGatewayConfig();
        this.conversationWindowSize = options.conversationWindowSize
            ?? this.nlConfig.conversationWindow.defaultSize;
    }
    /**
     * Get the configured conversation window size for a given task type
     */
    getConversationWindowSize(taskType) {
        return getConversationWindowSize(this.nlConfig, taskType);
    }
    /**
     * Get the configured clarification threshold
     */
    getClarificationThreshold() {
        return this.nlConfig.disambiguation.threshold;
    }
    /**
     * Check if clarification should be requested based on config
     */
    shouldRequestClarification(confidence) {
        return shouldRequestClarification(this.nlConfig, confidence);
    }
    async parse(request) {
        const detailed = await this.parseDetailed(request);
        const primary = detailed.detectedIntents[0];
        return {
            intent: primary?.intentType ?? "task_query",
            confidence: detailed.confidence,
            entities: Object.fromEntries((primary?.entities ?? []).map((entity) => [entity.entityType, String(entity.value)])),
        };
    }
    async parseDetailed(request) {
        const route = this.intakeRouter.route({
            title: deriveTitle(request.message),
            request: request.message,
        });
        const entities = extractEntities(request.message);
        const detectedIntent = {
            intentType: mapIntentType(route.classification.intent),
            domainHint: route.divisionId,
            entities,
            urgency: deriveUrgency(request.message),
            confidence: route.classification.confidence,
        };
        const clarificationQuestions = buildClarificationQuestions(request.message, route.classification.confidence, route.divisionId, entities);
        const locale = this.resolveLocale(request);
        return {
            rawInput: request.message,
            detectedIntents: [detectedIntent],
            confidence: route.classification.confidence,
            requiresClarification: route.classification.confidence < this.clarificationThreshold
                || clarificationQuestions.length > 0,
            locale,
            continuation: route.classification.continuation,
            suggestedDivisionId: route.divisionId,
            suggestedWorkflowId: route.workflowId,
            ...(clarificationQuestions.length > 0 ? { clarificationQuestions } : {}),
        };
    }
    async buildTask(request) {
        const detailed = await this.parseDetailed(request);
        const primaryIntent = detailed.detectedIntents[0] ?? {
            intentType: "task_query",
            domainHint: null,
            entities: [],
            urgency: "low",
            confidence: detailed.confidence,
        };
        const riskPreview = buildRiskPreview(request.message, primaryIntent.intentType);
        const costEstimate = this.costEstimator?.estimate(detailed.suggestedDivisionId) ?? defaultCostEstimate();
        const confirmationRequired = detailed.requiresClarification || riskPreview.approvalNeeded || riskPreview.overallRisk === "critical";
        const humanSummary = [
            `我将把请求路由到 ${detailed.suggestedDivisionId}`,
            `使用工作流 ${detailed.suggestedWorkflowId}`,
            `预估成本 $${costEstimate.estimatedCostUsd.toFixed(2)}`,
            `风险等级 ${riskPreview.overallRisk}`,
        ].join("，");
        return {
            requestEnvelope: createRequestEnvelope({
                principal: createPlatformPrincipal({
                    actorId: request.userId,
                    tenantId: request.tenantId,
                    roles: ["requester"],
                    authMethod: "nl_entry",
                }),
                tenantId: request.tenantId,
                payload: {
                    userId: request.userId,
                    title: deriveTitle(request.message),
                    request: request.message,
                    locale: detailed.locale,
                    channel: request.channel ?? null,
                    divisionId: detailed.suggestedDivisionId,
                    workflowId: detailed.suggestedWorkflowId,
                    intent: primaryIntent.intentType,
                    continuation: detailed.continuation,
                    entities: primaryIntent.entities,
                    confirmationRequired,
                    generatedSummary: humanSummary,
                },
                metadata: {
                    source: "nl_entry",
                    confirmationRequired,
                    divisionId: detailed.suggestedDivisionId,
                    workflowId: detailed.suggestedWorkflowId,
                    locale: detailed.locale,
                },
            }),
            riskPreview,
            costEstimate,
            confirmationRequired,
            humanSummary,
        };
    }
    resolveLocale(request) {
        const resolutionOrder = this.localeConfig.localeResolutionOrder ?? DEFAULT_LOCALE_CONFIG.localeResolutionOrder;
        for (const source of resolutionOrder) {
            if (source === "user_profile") {
                const candidate = request.preferredLocale ?? request.locale;
                if (candidate && this.localeConfig.supportedLocales.includes(candidate)) {
                    return candidate;
                }
            }
            if (source === "accept_language") {
                for (const candidate of parseAcceptLanguage(request.acceptLanguage)) {
                    if (this.localeConfig.supportedLocales.includes(candidate)) {
                        return candidate;
                    }
                    const partial = this.localeConfig.supportedLocales.find((item) => item.startsWith(candidate.split("-")[0] ?? ""));
                    if (partial) {
                        return partial;
                    }
                }
            }
            if (source === "input_detect") {
                const detected = detectInputLocale(request.message);
                if (detected && this.localeConfig.supportedLocales.includes(detected)) {
                    return detected;
                }
            }
            if (source === "default") {
                return this.localeConfig.defaultLocale;
            }
        }
        return this.localeConfig.defaultLocale;
    }
}
/**
 * Conversation Context Manager
 *
 * Manages multi-turn conversation context with configurable window size.
 * Window size can be configured per task type via nlGatewayConfig.
 */
export class ConversationContextManager {
    contexts = new Map();
    nlConfig;
    constructor(nlConfig) {
        this.nlConfig = nlConfig ?? loadNlGatewayConfig();
    }
    /**
     * Get or create a conversation context for a user
     */
    getContext(tenantId, userId, taskType) {
        const key = `${tenantId}:${userId}`;
        const existing = this.contexts.get(key);
        if (existing) {
            return existing;
        }
        const maxTurns = getConversationWindowSize(this.nlConfig, taskType);
        return {
            tenantId,
            userId,
            turnCount: 0,
            maxTurns,
            turns: [],
        };
    }
    /**
     * Add a turn to the conversation
     */
    addTurn(tenantId, userId, message, intent, taskType) {
        const key = `${tenantId}:${userId}`;
        const current = this.getContext(tenantId, userId, taskType);
        const maxTurns = getConversationWindowSize(this.nlConfig, taskType);
        const turn = {
            turnNumber: current.turnCount + 1,
            message,
            detectedIntent: intent,
            timestamp: new Date().toISOString(),
        };
        const updatedTurns = [...current.turns, turn];
        // Prune to window size
        const prunedTurns = updatedTurns.length > maxTurns
            ? updatedTurns.slice(-maxTurns)
            : updatedTurns;
        const updatedContext = {
            tenantId,
            userId,
            turnCount: prunedTurns.length,
            maxTurns,
            turns: prunedTurns,
            lastIntent: intent,
        };
        this.contexts.set(key, updatedContext);
        return updatedContext;
    }
    /**
     * Clear a conversation context
     */
    clearContext(tenantId, userId) {
        const key = `${tenantId}:${userId}`;
        this.contexts.delete(key);
    }
    /**
     * Check if conversation is approaching window limit
     */
    isNearWindowLimit(tenantId, userId) {
        const context = this.contexts.get(`${tenantId}:${userId}`);
        if (!context) {
            return false;
        }
        return context.turnCount >= context.maxTurns - 2;
    }
    /**
     * Get window size for a specific task type
     */
    getWindowSize(taskType) {
        return getConversationWindowSize(this.nlConfig, taskType);
    }
}
//# sourceMappingURL=index.js.map