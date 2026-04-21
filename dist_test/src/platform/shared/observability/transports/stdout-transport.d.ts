/**
 * Stdout Log Transport
 *
 * Writes structured log entries to stdout in JSON format.
 * Suitable for container environments where log collectors
 * (Fluentd, Datadog agent, etc.) capture stdout.
 */
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";
export declare class StdoutTransport implements LogTransport {
    readonly name = "stdout";
    write(entry: StructuredLogEntry): void;
}
