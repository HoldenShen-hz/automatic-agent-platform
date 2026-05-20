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
  const trimmedPattern = expectedPattern.trim();
  if (event.source !== expectedSource) {
    return false;
  }
  if (trimmedPattern.length === 0) {
    return true;
  }
  return compileEventPattern(trimmedPattern).test(event.name);
}

function compileEventPattern(pattern: string): RegExp {
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    return new RegExp(pattern.slice(1, -1));
  }
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*");
    return new RegExp(escaped);
  }
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}
