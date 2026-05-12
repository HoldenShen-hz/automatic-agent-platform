export interface PanicDirectiveInput {
  readonly scope: string;
  readonly reasonCode: string;
  readonly activeIncidents?: number;
}

export function shouldEnterPanicMode(input: PanicDirectiveInput): boolean {
  const hasIncidents = (input.activeIncidents ?? 0) > 0;
  const isSecurity = input.reasonCode.startsWith("security.");
  return hasIncidents || isSecurity;
}
