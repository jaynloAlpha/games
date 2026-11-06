/* eslint-disable no-undef */
(function () {
  const { escapeHtml, api, accentClass, coverMarkup, bindCoverFallbacks } = window.Clay;
  const grid = document.getElementById("gameGrid");
  const featuredSlot = document.getElementById("featuredSlot");
  const emptyState = document.getElementById("emptyState");
  const chipsHost = document.getElementById("categoryChips");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const resultCount = document.getElementById("resultCount");
  const statGames = document.getElementById("statGames");

  const state = {
    games: [],
    categories: [],
    site: null,
    category: "全部",
    query: "",
    sort: "curated",
  };

  async function boot() {
    try {
      const [site, payload] = await Promise.all([api("/api/site"), api("/api/games")]);
      state.site = site;
      state.games = payload.games || [];
      state.categories = payload.categories || site.categories || [];
      if (statGames) statGames.textContent = String(state.games.length);
      renderChips();
      render();
    } catch (error) {
      console.error(error);
      grid.innerHTML = "";
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent = "游戏列表加载失败";
      emptyState.querySelector("p").textContent = "请刷新页面再试一次。";
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

  function filtered() {
    const query = state.query.trim().toLowerCase();
    let list = state.games.filter((game) => {
      if (state.category !== "全部" && game.category !== state.category) return false;
      if (!query) return true;
      const haystack = [game.title, game.summary, game.category, ...(game.tags || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    if (state.sort === "new") {
      list = list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (state.sort === "name") {
      list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-CN"));
    }
    return list;
  }

  function render() {
    const list = filtered();
    const isBrowsingAll =
      state.category === "全部" && !state.query.trim() && state.sort === "curated";
    const featured = isBrowsingAll ? list.find((game) => game.featured) : null;
    const rest = featured ? list.filter((game) => game.slug !== featured.slug) : list;

    resultCount.textContent = list.length ? `共 ${list.length} 个游戏` : "";
    featuredSlot.innerHTML = featured ? featuredMarkup(featured) : "";
    bindCoverFallbacks(featuredSlot);

    grid.innerHTML = rest.map((game, index) => cardMarkup(game, index)).join("");
    bindCoverFallbacks(grid);

    if (!state.games.length) {
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent = "还没有游戏上架";
      emptyState.querySelector("p").textContent =
        "在 games/ 下新建一个文件夹，放进 game.json 和 index.html，这里就会出现一张卡片。";
      const hint = emptyState.querySelector(".empty-hint");
      if (hint) hint.hidden = false;
      resultCount.textContent = "";
    } else if (!list.length) {
      emptyState.hidden = false;
      emptyState.querySelector("h3").textContent = "没有找到这个游戏";
      emptyState.querySelector("p").textContent = "换个关键词，或者点上面的「全部」看看。";
      const hint = emptyState.querySelector(".empty-hint");
      if (hint) hint.hidden = true;
    } else {
      emptyState.hidden = true;
    }
  }

  function cardMarkup(game, index) {
    const summary = game.summary ? escapeHtml(game.summary) : "点开就能玩";
    const footLeft = game.controls ? escapeHtml(game.controls) : "点开就玩";
    return `
      <article class="game-card ${accentClass(game.accent)}" style="--delay: ${Math.min(index * 45, 360)}ms">
        <a class="game-card-link" href="/play/${encodeURIComponent(game.slug)}" aria-label="开始玩 ${escapeHtml(game.title)}">
          ${coverMarkup(game)}
          ${game.age ? `<span class="badge-age">${escapeHtml(game.age)}</span>` : ""}
          <span class="play-bubble" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5Z"/></svg>
          </span>
          <div class="game-body">
            <div class="game-title-row">
              <h3>${escapeHtml(game.title)}</h3>
              <span class="game-cat">${escapeHtml(game.category || "小游戏")}</span>
            </div>
            <p>${summary}</p>
            <div class="game-foot">
              <span class="plays">🎮 ${footLeft}</span>
              <span>开玩 →</span>
            </div>
          </div>
        </a>
      </article>`;
  }

  function featuredMarkup(game) {
    const meta = [game.category, game.age].filter(Boolean).map(escapeHtml).join(" · ");
    return `
      <article class="featured ${accentClass(game.accent)}">
        <div class="featured-cover">
          ${
            game.cover
              ? `<img data-cover data-icon="${escapeHtml(game.icon || "🎮")}" src="/covers/${encodeURIComponent(
                  game.slug
                )}?v=${game.updatedAt || 0}" alt="${escapeHtml(game.title)} 封面">`
              : `<div class="cover-fallback"><span class="cover-spark" aria-hidden="true">✦</span><span class="cover-icon" aria-hidden="true">${escapeHtml(
                  game.icon || "🎮"
                )}</span></div>`
          }
        </div>
        <div class="featured-copy">
          <span class="pill">⭐ 本周推荐</span>
          <h2>${escapeHtml(game.title)}</h2>
          <p>${escapeHtml(game.summary || "点开就能玩的小游戏。")}</p>
          <div class="featured-actions">
            <a class="btn btn-on-color btn-lg" href="/play/${encodeURIComponent(game.slug)}">马上开玩</a>
            <span class="pill">${meta || "全年龄"}</span>
          </div>
        </div>
      </article>`;
  }

  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value;
      render();
    }, 130);
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    render();
  });

  boot();
})();
