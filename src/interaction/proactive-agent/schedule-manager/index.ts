function parseDurationMs(raw: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw.trim());
  if (!match) {
    return 0;
  }
  const value = Number(match[1]);
  switch (match[2]) {
    case "ms": return value;
    case "s": return value * 1000;
    case "m": return value * 60_000;
    case "h": return value * 3_600_000;
    case "d": return value * 86_400_000;
    default: return 0;
  }
}

export function shouldRunScheduleTrigger(lastFiredAt: string | null, nowIso: string, cooldown: string): boolean {
  if (lastFiredAt == null) {
    return true;
  }
  return Date.parse(nowIso) - Date.parse(lastFiredAt) >= parseDurationMs(cooldown);
}
