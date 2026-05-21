export interface ProactiveEventInput {
  readonly source: string;
  readonly name: string;
  readonly payload?: Record<string, unknown>;
}

const EVENT_PATTERN_CACHE = new Map<string, RegExp>();

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
  const cached = EVENT_PATTERN_CACHE.get(pattern);
  if (cached != null) {
    return cached;
  }
  let compiled: RegExp;
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    compiled = new RegExp(pattern.slice(1, -1));
  } else if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*");
    compiled = new RegExp(escaped);
  } else {
    compiled = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  EVENT_PATTERN_CACHE.set(pattern, compiled);
  return compiled;
}
