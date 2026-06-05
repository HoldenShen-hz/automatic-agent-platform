export async function copyTextToClipboard(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard != null && typeof navigator.clipboard.writeText === "function") {
        try {
            await navigator.clipboard.writeText(text);
            return;
        }
        catch {
        }
    }
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
        return;
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
    try {
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        document.execCommand?.("copy");
    }
    catch {
    }
    finally {
        textarea.remove();
        activeElement?.focus?.();
    }
}
