export interface PanicDirectiveInput {
  readonly scope: string;
  readonly reasonCode: string;
  readonly activeIncidents?: number;
}

const ADVISORY_ONLY_SECURITY_PREFIXES = [
  "security.",
  "security.advisory",
  "security.audit",
  "security.certificate_expiry",
  "security.policy_warning",
  "security.vulnerability",
] as const;

export function shouldEnterPanicMode(input: PanicDirectiveInput): boolean {
  const hasIncidents = (input.activeIncidents ?? 0) > 0;
  const normalizedReason = input.reasonCode.trim().toLowerCase();
  if (hasIncidents) {
    return true;
  }
  if (!normalizedReason.startsWith("security.")) {
    return false;
  }
  return !ADVISORY_ONLY_SECURITY_PREFIXES.includes(normalizedReason as (typeof ADVISORY_ONLY_SECURITY_PREFIXES)[number]);
}
