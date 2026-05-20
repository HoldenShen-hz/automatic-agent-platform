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
  return event.source === expectedSource && compileEventPattern(expectedPattern).test(event.name);
}

function compileEventPattern(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (trimmed.startsWith("/") && trimmed.endsWith("/") && trimmed.length > 2) {
    return new RegExp(trimmed.slice(1, -1));
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*");
  return new RegExp(`^${escaped}$`, "i");
}
