import { setTimeout as sleep } from "node:timers/promises";

export function heapUsedBytes(): number {
  return process.memoryUsage().heapUsed;
}

export function rssBytes(): number {
  return process.memoryUsage().rss;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

export function isExplicitGcAvailable(): boolean {
  return typeof (globalThis as { gc?: unknown }).gc === "function";
}

export async function forceFullGc(cycles = 3): Promise<void> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc !== "function") {
    throw new Error("global.gc is unavailable; run Node with --expose-gc for leak tests");
  }

  for (let index = 0; index < cycles; index += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    gc();
    await sleep(0);
  }
}
