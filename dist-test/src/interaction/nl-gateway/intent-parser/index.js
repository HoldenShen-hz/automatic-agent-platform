export function parseIntentTokens(message) {
    const normalized = message.toLowerCase();
    if (/(approve|审批|通过)/i.test(message)) {
        return [{ intentType: "approval_action", confidence: 0.92 }];
    }
    if (/(status|状态|summary|同步)/i.test(message)) {
        return [{ intentType: "status_inquiry", confidence: 0.84 }];
    }
    if (/(delete|remove|删除|修改)/i.test(message)) {
        return [{ intentType: "task_modify", confidence: 0.8 }];
    }
    if (/(create|make|生成|创建|做一个)/i.test(normalized) || normalized.length > 12) {
        return [{ intentType: "task_create", confidence: 0.88 }];
    }
    return [{ intentType: "task_query", confidence: 0.62 }];
}
//# sourceMappingURL=index.js.map