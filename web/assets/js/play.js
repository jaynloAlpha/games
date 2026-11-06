/* eslint-disable no-undef */
(function () {
  const { api, escapeHtml, toast, bindCoverFallbacks } = window.Clay;

  const body = document.body;
  const slug = body.dataset.slug;
  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  const loading = document.getElementById("loading");
  const playSub = document.getElementById("playSub");
  const metaRow = document.getElementById("metaRow");
  const infoDesc = document.getElementById("infoDesc");
  const tagRow = document.getElementById("tagRow");
  const nextList = document.getElementById("nextList");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const restartBtn = document.getElementById("restartBtn");

  let game = null;
  let gameUrl = "";

  function showError(message) {
    stage.innerHTML = `
      <div class="stage-error">
        <img src="/assets/img/mascot.svg" alt="" width="140" height="140">
        <h2>游戏没有打开</h2>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-primary" href="/">回到乐园</a>
      </div>`;
    if (loading) loading.remove();
    playSub.textContent = "没能加载这个游戏";
    infoDesc.textContent = message;
  }

  function applyMeta() {
    playSub.textContent = [game.category, game.age].filter(Boolean).join(" · ");
    const pills = [];
    if (game.age) pills.push(`<span class="pill">👶 ${escapeHtml(game.age)}</span>`);
    if (game.category) pills.push(`<span class="pill">🎯 ${escapeHtml(game.category)}</span>`);
    if (game.controls) pills.push(`<span class="pill">🎮 ${escapeHtml(game.controls)}</span>`);
    metaRow.innerHTML = pills.join("");
    infoDesc.textContent =
      game.description || game.summary || "这个小游戏还没有写介绍，点开玩就知道了。";
    tagRow.innerHTML = (game.tags || [])
      .map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`)
      .join("");
  }

  function startGame() {
    const entry = (game.entry || "index.html")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    gameUrl = `/games/${encodeURIComponent(slug)}/${entry}`;
    loading.classList.remove("is-hidden");
    frame.src = gameUrl;
    frame.addEventListener("load", () => loading.classList.add("is-hidden"));
  }

  function restartGame() {
    if (!gameUrl) return;
    loading.classList.remove("is-hidden");
    frame.src = `${gameUrl}?r=${Date.now()}`;
  }

  async function loadNext() {
    try {
      const payload = await api("/api/games");
      const others = (payload.games || []).filter((item) => item.slug !== slug).slice(0, 3);
      if (!others.length) {
        nextList.innerHTML = '<p class="result-count">还没有别的游戏，敬请期待。</p>';
        return;
      }
      nextList.innerHTML = others
        .map((item) => {
          const thumb = item.cover
            ? `<span class="next-thumb"><img data-cover data-icon="${escapeHtml(
                item.icon || "🎮"
              )}" src="/covers/${encodeURIComponent(item.slug)}?v=${
                item.updatedAt || 0
              }" alt="" loading="lazy"></span>`
            : `<span class="next-thumb">${escapeHtml(item.icon || "🎮")}</span>`;
          const metaText = [item.category, item.age].filter(Boolean).map(escapeHtml).join(" · ");
          return `
            <a class="next-card" href="/play/${encodeURIComponent(item.slug)}">
              ${thumb}
              <span class="row-main">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${metaText}</small>
              </span>
            </a>`;
        })
        .join("");
      bindCoverFallbacks(nextList);
    } catch {
      nextList.innerHTML = '<p class="result-count">其他游戏加载失败。</p>';
    }
  }

  fullscreenBtn.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      try {
        await stage.requestFullscreen();
      } catch {
        toast("这个浏览器不支持全屏", "error");
      }
    } else {
      await document.exitFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const isFull = Boolean(document.fullscreenElement);
    fullscreenBtn.querySelector(".label").textContent = isFull ? "退出全屏" : "全屏";
  });

  restartBtn.addEventListener("click", restartGame);

  (async function boot() {
    try {
      game = await api(`/api/games/${encodeURIComponent(slug)}`);
      applyMeta();
      startGame();
      loadNext();
    } catch (error) {
      showError(
        error.status === 404
          ? "这个游戏可能被下架了，或者链接不对。"
          : error.message || "网络不太稳定，刷新试试。"
      );
    }
  })();
})();
