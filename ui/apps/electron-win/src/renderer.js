const root = document.getElementById("root");

if (root != null) {
  const bridge = globalThis.AA_ELECTRON;
  const capabilities = [
    ["Shell runtime", "Electron"],
    ["Secure bridge", typeof bridge === "object" && bridge !== null ? "ready" : "unavailable"],
    [
      "Screen security",
      typeof bridge?.privacy?.enableScreenSecurity === "function" ? "supported" : "not-exposed",
    ],
  ];

  root.replaceChildren();

  const container = document.createElement("main");
  container.setAttribute("aria-label", "Electron shell runtime");
  container.style.display = "grid";
  container.style.gap = "12px";
  container.style.padding = "20px";

  const title = document.createElement("h1");
  title.textContent = "Automatic Agent Platform Electron Shell";
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
