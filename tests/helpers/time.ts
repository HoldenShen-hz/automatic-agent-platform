export interface MockDateNow {
  readonly current: () => number;
  readonly set: (next: number) => number;
  readonly advance: (deltaMs: number) => number;
  readonly restore: () => void;
}

export function installMockDateNow(startMs = 0): MockDateNow {
  const originalDateNow = Date.now;
  let currentMs = startMs;
  Date.now = () => currentMs;
  return {
    current: () => currentMs,
    set: (next) => {
      currentMs = next;
      return currentMs;
    },
    advance: (deltaMs) => {
      currentMs += deltaMs;
      return currentMs;
    },
    restore: () => {
      Date.now = originalDateNow;
    },
  };
}
