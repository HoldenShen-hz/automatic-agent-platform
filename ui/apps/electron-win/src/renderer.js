const root = document.getElementById("root");

if (root != null) {
  const bridge = globalThis.AA_ELECTRON;
  const locale = document.documentElement.lang.toLowerCase();
  const useChinese = locale.startsWith("zh");
  const capabilities = [
    [useChinese ? "桌面运行时" : "Desktop Runtime", "Electron"],
    [useChinese ? "安全桥接" : "Secure Bridge", typeof bridge === "object" && bridge !== null ? (useChinese ? "已就绪" : "ready") : (useChinese ? "不可用" : "unavailable")],
    [
      useChinese ? "屏幕安全" : "Screen Security",
      typeof bridge?.enableScreenSecurity === "function" ? (useChinese ? "已支持" : "supported") : (useChinese ? "未暴露" : "not-exposed"),
    ],
  ];

  root.replaceChildren();

  const container = document.createElement("main");
  container.setAttribute("aria-label", "Electron shell runtime fallback");
  container.style.display = "grid";
  container.style.gap = "12px";
  container.style.padding = "20px";

  const title = document.createElement("h1");
  title.textContent = useChinese
    ? "Automatic Agent Platform Electron 桌面回退壳"
    : "Automatic Agent Platform Electron Fallback Shell";
  container.appendChild(title);

  const list = document.createElement("dl");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "max-content 1fr";
  list.style.gap = "8px 16px";

  for (const [label, value] of capabilities) {
    const term = document.createElement("dt");
    term.textContent = label;
    term.style.fontWeight = "700";
    const detail = document.createElement("dd");
    detail.textContent = value;
    detail.style.margin = "0";
    list.append(term, detail);
  }

  container.appendChild(list);
  root.appendChild(container);
}
