export async function copyTextToClipboard(text) {
    let clipboardApiError = null;
    if (typeof navigator !== "undefined" && navigator.clipboard != null && typeof navigator.clipboard.writeText === "function") {
        try {
            await navigator.clipboard.writeText(text);
            return;
        }
        catch (error) {
            clipboardApiError = error;
        }
    }
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
        throw createClipboardCopyError(clipboardApiError);
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let copied = false;
    let fallbackError = null;
    try {
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        copied = document.execCommand?.("copy") === true;
    }
    catch (error) {
        fallbackError = error;
    }
    finally {
        textarea.remove();
        activeElement?.focus?.();
    }
    if (!copied) {
        throw createClipboardCopyError(fallbackError ?? clipboardApiError);
    }
}
function createClipboardCopyError(cause) {
    if (cause instanceof Error && cause.message.trim().length > 0) {
        return new Error(`Unable to copy to clipboard: ${cause.message}`);
    }
    if (typeof cause === "string" && cause.trim().length > 0) {
        return new Error(`Unable to copy to clipboard: ${cause}`);
    }
    return new Error("Unable to copy to clipboard in the current browser context.");
}
