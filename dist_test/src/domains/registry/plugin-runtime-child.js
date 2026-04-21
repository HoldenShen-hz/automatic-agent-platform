import { createRequire, syncBuiltinESMExports } from "node:module";
import { format } from "node:util";
import { createBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
const require = createRequire(import.meta.url);
let currentPluginId = null;
let currentPlugin = null;
let stdoutBuffer = "";
installRuntimeGuards();
installStdioProtocolConsoleRedirection();
function getPlugin(pluginId) {
    if (currentPluginId === pluginId && currentPlugin) {
        return currentPlugin;
    }
    const plugin = createBuiltinPlugin(pluginId);
    if (!plugin) {
        throw new Error(`Builtin plugin ${pluginId} is not available for forked runtime isolation.`);
    }
    currentPluginId = pluginId;
    currentPlugin = plugin;
    return plugin;
}
async function handleRequest(request) {
    const plugin = getPlugin(request.pluginId);
    switch (request.action) {
        case "load":
            if (plugin.onLoad && request.context) {
                await plugin.onLoad(request.context);
            }
            else if (plugin.initialize) {
                await plugin.initialize();
            }
            return null;
        case "activate":
            if (plugin.onActivate && request.context) {
                await plugin.onActivate(request.context);
            }
            return null;
        case "health_check":
            return plugin.healthCheck ? await plugin.healthCheck() : true;
        case "deactivate":
            if (plugin.onDeactivate && request.context) {
                await plugin.onDeactivate(request.context);
            }
            return null;
        case "unload":
            if (plugin.onUnload && request.context) {
                await plugin.onUnload(request.context);
            }
            else if (plugin.shutdown) {
                await plugin.shutdown();
            }
            return null;
        case "retrieve":
            if (plugin.spiType !== "retriever") {
                throw new Error(`Plugin ${plugin.pluginId} is not a retriever.`);
            }
            return plugin.retrieve(request.input);
        case "present":
            if (plugin.spiType !== "presenter") {
                throw new Error(`Plugin ${plugin.pluginId} is not a presenter.`);
            }
            return plugin.formatOutput(request.input);
        case "authenticate":
            if (plugin.spiType !== "adapter") {
                throw new Error(`Plugin ${plugin.pluginId} is not an adapter.`);
            }
            await plugin.authenticate(request.input);
            return null;
        case "execute":
            if (plugin.spiType !== "adapter") {
                throw new Error(`Plugin ${plugin.pluginId} is not an adapter.`);
            }
            return plugin.execute(request.input.action, request.input.params);
        default:
            throw new Error(`Unsupported plugin runtime action ${request.action ?? "unknown"}.`);
    }
}
function installRuntimeGuards() {
    const sandboxRoot = process.env.AA_PLUGIN_SANDBOX_ROOT?.trim();
    if (sandboxRoot) {
        process.chdir(sandboxRoot);
    }
    if (process.env.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "true") {
        return;
    }
    const deny = () => {
        throw new Error(`Plugin ${process.env.AA_PLUGIN_RUNTIME_PLUGIN_ID ?? "unknown"} cannot use network egress in ${process.env.AA_PLUGIN_RUNTIME_ISOLATION ?? "isolated"} runtime.`);
    };
    const http = require("node:http");
    const https = require("node:https");
    const net = require("node:net");
    const tls = require("node:tls");
    http.request = deny;
    http.get = deny;
    https.request = deny;
    https.get = deny;
    net.connect = deny;
    net.createConnection = deny;
    tls.connect = deny;
    globalThis.fetch = (async () => {
        deny();
    });
    syncBuiltinESMExports();
}
process.on("message", (message) => {
    handleRuntimeMessage(message);
});
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex === -1) {
            break;
        }
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (line.length === 0) {
            continue;
        }
        try {
            handleRuntimeMessage(JSON.parse(line));
        }
        catch (error) {
            process.stderr.write(`plugin-runtime-child invalid stdio payload: ${error instanceof Error ? error.message : String(error)}\n`);
        }
    }
});
function installStdioProtocolConsoleRedirection() {
    if (process.send) {
        return;
    }
    const writeToStderr = (...args) => {
        process.stderr.write(`${format(...args)}\n`);
    };
    console.log = writeToStderr;
    console.info = writeToStderr;
    console.debug = writeToStderr;
    console.warn = writeToStderr;
    console.error = writeToStderr;
}
function sendRuntimeMessage(message) {
    if (!process.send) {
        process.stdout.write(`${JSON.stringify(message)}\n`);
        return;
    }
    process.send(message);
}
function handleRuntimeMessage(message) {
    const payload = message;
    if (payload?.type === "shutdown") {
        process.disconnect?.();
        setImmediate(() => process.exit(0));
        return;
    }
    const request = payload;
    if (request?.type !== "request") {
        return;
    }
    void handleRequest(request)
        .then((result) => {
        sendRuntimeMessage({
            type: "response",
            requestId: request.requestId,
            ok: true,
            pid: process.pid,
            result,
        });
    })
        .catch((error) => {
        sendRuntimeMessage({
            type: "response",
            requestId: request.requestId,
            ok: false,
            pid: process.pid,
            error: {
                name: error instanceof Error ? error.name : "Error",
                message: error instanceof Error ? error.message : String(error),
            },
        });
    });
}
sendRuntimeMessage({
    type: "ready",
    pid: process.pid,
});
//# sourceMappingURL=plugin-runtime-child.js.map