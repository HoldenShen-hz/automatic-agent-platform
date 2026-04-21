import { ValidationError } from "../../../platform/contracts/errors.js";
export function assertIdentifier(value, code) {
    if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
        throw new ValidationError(code, `${code}: Invalid identifier format '${value}'`, {
            details: { value, pattern: "^[a-zA-Z0-9._:-]{2,128}$" },
        });
    }
    return value;
}
export function assertPositiveNumber(value, code) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new ValidationError(code, `${code}: Value must be a positive number, got: ${value}`, {
            details: { value },
        });
    }
    return value;
}
export function roundCurrency(value) {
    return Math.round(value * 10_000) / 10_000;
}
export function monthWindow(at) {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) {
        throw new ValidationError("billing.invalid_timestamp", `Invalid timestamp: ${at}`, {
            details: { timestamp: at },
        });
    }
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)).toISOString();
    return {
        start,
        end,
        periodId: `${year}-${String(month + 1).padStart(2, "0")}`,
    };
}
export function buildBillingMarkdown(summary) {
    const lines = [
        "# Billing Account Summary",
        "",
        `- Account: \`${summary.account.accountId}\``,
        `- Plan: \`${summary.plan.planId}\``,
        `- Status: \`${summary.account.status}\``,
        `- Generated At: \`${summary.generatedAt}\``,
        `- Usage Events: ${summary.totals.usageEventCount}`,
        `- Ledger Entries: ${summary.totals.ledgerEntryCount}`,
        `- Total Billed USD: ${summary.totals.totalBilledUsd}`,
        "",
        "## Quotas",
        "",
        ...summary.quotas.map((quota) => `- ${quota.metricType}: used=${quota.usedQuantity}, limit=${quota.limitQuantity ?? "unlimited"}, remaining=${quota.remainingQuantity ?? "n/a"}, type=${quota.limitType ?? "n/a"}, window=${quota.windowStart} -> ${quota.windowEnd}`),
    ];
    return lines.join("\n");
}
//# sourceMappingURL=utils.js.map