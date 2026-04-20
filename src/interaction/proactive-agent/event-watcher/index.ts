export interface ProactiveEventInput {
  readonly source: string;
  readonly name: string;
  readonly payload?: Record<string, unknown>;
}

export function shouldConsumeProactiveEvent(
  event: ProactiveEventInput,
  expectedSource: string,
  expectedPattern: string,
): boolean {
  return event.source === expectedSource && event.name.includes(expectedPattern);
}
