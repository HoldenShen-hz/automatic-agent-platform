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

export async function forceFullGc(cycles = 3): Promise<void> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc !== "function") {
    return;
  }

  for (let index = 0; index < cycles; index += 1) {
    gc();
    await sleep(0);
  }
}
