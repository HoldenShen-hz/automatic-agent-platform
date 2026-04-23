export const UNIFIED_SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"];
export const UNIFIED_SEVERITY_SLA = {
    SEV1: {
        acknowledgeWithinMinutes: 5,
        mitigateWithinMinutes: 30,
        ownerExpectation: "page_immediately",
    },
    SEV2: {
        acknowledgeWithinMinutes: 15,
        mitigateWithinMinutes: 120,
        ownerExpectation: "engage_primary_oncall",
    },
    SEV3: {
        acknowledgeWithinMinutes: 60,
        mitigateWithinMinutes: 480,
        ownerExpectation: "same_shift_response",
    },
    SEV4: {
        acknowledgeWithinMinutes: 240,
        mitigateWithinMinutes: 1440,
        ownerExpectation: "business_hours_follow_up",
    },
};
export function anomalySeverityToUnifiedSeverity(severity) {
    switch (severity) {
        case "emergency":
            return "SEV1";
        case "critical":
            return "SEV2";
        case "warning":
            return "SEV3";
        case "info":
        default:
            return "SEV4";
    }
}
export function alertSeverityToUnifiedSeverity(severity) {
    switch (severity) {
        case "page":
            return "SEV1";
        case "critical":
            return "SEV2";
        case "warning":
            return "SEV3";
        case "info":
        default:
            return "SEV4";
    }
}
export function runbookSeverityToUnifiedSeverity(severity) {
    switch (severity) {
        case "P0":
            return "SEV1";
        case "P1":
            return "SEV2";
        case "P2":
            return "SEV3";
        case "P3":
        default:
            return "SEV4";
    }
}
export function diagnosticSeverityToUnifiedSeverity(severity) {
    switch (severity) {
        case "critical":
            return "SEV2";
        case "warning":
            return "SEV3";
        case "info":
        default:
            return "SEV4";
    }
}
//# sourceMappingURL=unified-severity.js.map