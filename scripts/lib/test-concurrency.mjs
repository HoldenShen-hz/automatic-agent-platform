import { availableParallelism, cpus } from "node:os";

const DEFAULT_CONCURRENCY_CAP = 12;

export function resolveDefaultTestConcurrency(cap = DEFAULT_CONCURRENCY_CAP) {
  const hostParallelism = typeof availableParallelism === "function"
    ? availableParallelism()
    : cpus().length;
  const safeCap = Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_CONCURRENCY_CAP;
  return Math.max(1, Math.min(hostParallelism, safeCap));
}
