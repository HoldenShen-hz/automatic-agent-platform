/**
 * Log Transport Interface
 *
 * Defines the contract for log transport adapters that can receive
 * structured log entries and forward them to external systems.
 */
import type { StructuredLogEntry } from "./structured-logger.js";
export interface LogTransport {
    readonly name: string;
    write(entry: StructuredLogEntry): void | Promise<void>;
    flush?(): Promise<void>;
    close?(): Promise<void>;
}
