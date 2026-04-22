/**
 * Stdout Log Transport
 *
 * Writes structured log entries to stdout in JSON format.
 * Suitable for container environments where log collectors
 * (Fluentd, Datadog agent, etc.) capture stdout.
 */

import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";

export class StdoutTransport implements LogTransport {
  readonly name = "stdout";

  write(entry: StructuredLogEntry): void {
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  async flush(): Promise<void> {
    // No-op for stdout - always flushed
  }

  async close(): Promise<void> {
    // No-op for stdout - cannot close stdout
  }
}
