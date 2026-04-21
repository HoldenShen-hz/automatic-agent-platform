import { DataClassificationService } from "../../control-plane/iam/data-classification-service.js";
const SECRET_PATTERNS = [
    {
        code: "artifact.secret.aws_access_key_detected",
        description: "AWS access key pattern detected.",
        pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    },
    {
        code: "artifact.secret.private_key_detected",
        description: "Private key block detected.",
        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    },
    {
        code: "artifact.secret.jwt_detected",
        description: "JWT token pattern detected.",
        pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    },
    {
        code: "artifact.secret.generic_token_detected",
        description: "Generic API key, token, or secret assignment detected.",
        pattern: /\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?(?!\/\/)(?![A-Za-z][A-Za-z0-9+.-]*:\/\/)[A-Za-z0-9_./+=-]{12,}["']?/gi,
    },
];
export class SensitiveContentScanner {
    classifier = new DataClassificationService({
        autoDetectPii: true,
        enableAuditTrail: false,
    });
    scanText(content) {
        const findings = [];
        for (const secretPattern of SECRET_PATTERNS) {
            const regex = new RegExp(secretPattern.pattern.source, secretPattern.pattern.flags);
            for (const match of content.matchAll(regex)) {
                findings.push({
                    code: secretPattern.code,
                    kind: "secret",
                    severity: "critical",
                    description: secretPattern.description,
                    redactedSample: redactSecretSample(match[0]),
                });
            }
        }
        for (const pii of this.classifier.detectPii(content)) {
            findings.push({
                code: `artifact.pii.${pii.type}_detected`,
                kind: "pii",
                severity: "warning",
                description: `${formatPiiType(pii.type)} PII detected.`,
                redactedSample: pii.redactedForm,
            });
        }
        const deduped = dedupeFindings(findings);
        const criticalFindingCount = deduped.filter((finding) => finding.severity === "critical").length;
        return {
            findings: deduped,
            criticalFindingCount,
            blocked: criticalFindingCount > 0,
        };
    }
    scanStructured(value) {
        if (value === undefined) {
            return { findings: [], criticalFindingCount: 0, blocked: false };
        }
        return this.scanText(JSON.stringify(value, null, 2));
    }
}
function dedupeFindings(findings) {
    const seen = new Set();
    const deduped = [];
    for (const finding of findings) {
        const key = `${finding.code}:${finding.redactedSample}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(finding);
    }
    return deduped;
}
function formatPiiType(type) {
    return type.replace(/_/g, " ");
}
function redactSecretSample(value) {
    if (value.length <= 8) {
        return "[REDACTED]";
    }
    return `${value.slice(0, 4)}...[REDACTED]...${value.slice(-4)}`;
}
//# sourceMappingURL=sensitive-content-scanner.js.map