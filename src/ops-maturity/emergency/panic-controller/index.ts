export interface PanicDirectiveInput {
  readonly scope: string;
  readonly reasonCode: string;
  readonly activeIncidents: number;
}

export function shouldEnterPanicMode(input: PanicDirectiveInput): boolean {
  return input.activeIncidents > 0 || input.reasonCode.startsWith("security.");
}
