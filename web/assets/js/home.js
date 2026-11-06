/* eslint-disable no-undef */
(function () {
  const { escapeHtml, api, accentClass, coverMarkup, bindCoverFallbacks } = window.Clay;
  const grid = document.getElementById("gameGrid");
  const emptyState = document.getElementById("emptyState");
  const chipsHost = document.getElementById("categoryChips");

  const state = {
    games: [],
    categories: [],
    category: "全部",
  };

  async function boot() {
    try {
      const payload = await api("/api/games");
      state.games = payload.games || [];
      state.categories = payload.categories || [];
      renderChips();
      render();
    } catch (error) {
      console.error(error);
      grid.innerHTML = "";
      emptyState.hidden = false;
      emptyState.querySelector("p").textContent = "游戏列表加载失败，刷新页面再试一次。";
    }
  }

  function renderChips() {
    const all = ["全部", ...state.categories];
    chipsHost.innerHTML = all
      .map(
        (name) =>
          `<button type="button" class="chip ${name === state.category ? "is-active" : ""}" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`
      )
      .join("");
    chipsHost.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.category = chip.dataset.category;
        renderChips();
        render();
      });
    });
  }

  function render() {
    const list = state.games.filter(
      (game) => state.category === "全部" || game.category === state.category
    );

    grid.innerHTML = list.map((game, index) => cardMarkup(game, index)).join("");
    bindCoverFallbacks(grid);
    emptyState.hidden = Boolean(list.length);

    if (!state.games.length) {
      emptyState.querySelector("p").innerHTML =
        '还没有游戏。把游戏放进 <code>games/</code> 目录，刷新页面就会出现。';
    } else if (!list.length) {
      emptyState.querySelector("p").textContent = "这个分类下还没有游戏。";
    }
  }

  function cardMarkup(game, index) {
    const summary = game.summary || "点开就能玩";
    const meta = [game.age, game.category || "小游戏"]
      .filter(Boolean)
      .map(escapeHtml)
      .join('<span class="meta-dot" aria-hidden="true"></span>');
    const featured = game.featured ? '<span class="badge-featured">★ 推荐</span>' : "";
    return `
      <article class="game-card ${accentClass(game.accent)}" style="--delay: ${Math.min(
        index * 40,
        280
      )}ms">
        <a class="game-card-link" href="/play/${encodeURIComponent(game.slug)}" aria-label="开始玩 ${escapeHtml(
          game.title
        )}">
          <div class="game-cover-wrap">
            ${coverMarkup(game)}
            ${featured}
          </div>
          <div class="game-body">
            <h3>${escapeHtml(game.title)}</h3>
            <p class="game-summary">${escapeHtml(summary)}</p>
            <div class="game-meta">
              <span class="game-meta-text">${meta}</span>
              <span class="game-open">开玩
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </div>
          </div>
        </a>
      </article>`;
  }

  boot();
})();
