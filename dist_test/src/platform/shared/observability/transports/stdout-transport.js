/**
 * Stdout Log Transport
 *
 * Writes structured log entries to stdout in JSON format.
 * Suitable for container environments where log collectors
 * (Fluentd, Datadog agent, etc.) capture stdout.
 */
export class StdoutTransport {
    name = "stdout";
    write(entry) {
        process.stdout.write(JSON.stringify(entry) + "\n");
    }
}
//# sourceMappingURL=stdout-transport.js.map