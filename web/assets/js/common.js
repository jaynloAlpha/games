/* Shared helpers for Clay Play pages. */
(function () {
  const ACCENTS = ["pink", "teal", "lavender", "peach", "ochre", "mint", "coral"];
  const ACCENT_COLORS = {
    pink: "#ff4d8b",
    teal: "#1a3a3a",
    lavender: "#b8a4ed",
    peach: "#ffb084",
    ochre: "#e8b94a",
    mint: "#a4d4c5",
    coral: "#ff6b5a",
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const response = await fetch(path, Object.assign({}, options, { headers }));
    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    }
    if (!response.ok) {
      const message =
        (data && data.error && data.error.message) || `请求失败（${response.status}）`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function accentClass(accent) {
    return ACCENTS.includes(accent) ? `accent-${accent}` : "accent-peach";
  }

  function toast(message, kind) {
    const host = document.getElementById("toasts");
    if (!host) return;
    const node = document.createElement("div");
    node.className = `toast ${kind || ""}`.trim();
    node.textContent = message;
    host.appendChild(node);
    setTimeout(() => {
      node.style.opacity = "0";
      node.style.transition = "opacity .2s";
      setTimeout(() => node.remove(), 220);
    }, 3200);
  }

  function coverMarkup(game, options = {}) {
    const cls = options.className || "game-cover";
    if (game.cover) {
      return `<div class="${cls}"><img data-cover data-icon="${escapeHtml(
        game.icon || "🎮"
      )}" src="/covers/${encodeURIComponent(game.slug)}?v=${
        game.updatedAt || 0
      }" alt="" loading="lazy"></div>`;
    }
    return `<div class="${cls}"><div class="cover-fallback"><span class="cover-spark" aria-hidden="true">✦</span><span class="cover-icon" aria-hidden="true">${escapeHtml(
      game.icon || "🎮"
    )}</span></div></div>`;
  }

  /** 封面图 404 时退化成 emoji（CSP 禁止内联 onerror，所以在这里统一绑定）。 */
  function bindCoverFallbacks(root) {
    if (!root) return;
    root.querySelectorAll("img[data-cover]").forEach((img) => {
      img.addEventListener(
        "error",
        () => {
          const wrap =
            img.closest(".game-cover, .featured-cover, .row-thumb, .next-thumb") ||
            img.parentElement;
          if (!wrap) return;
          img.remove();
          const fallback = document.createElement("div");
          fallback.className = "cover-fallback";
          fallback.innerHTML = `<span class="cover-spark" aria-hidden="true">✦</span><span class="cover-icon" aria-hidden="true">${escapeHtml(
            img.dataset.icon || "🎮"
          )}</span>`;
          wrap.appendChild(fallback);
        },
        { once: true }
      );
    });
  }

  window.Clay = {
    ACCENTS,
    ACCENT_COLORS,
    escapeHtml,
    api,
    accentClass,
    toast,
    coverMarkup,
    bindCoverFallbacks,
  };
})();
