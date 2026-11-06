/* eslint-disable no-undef */
(function () {
  const { api, escapeHtml, toast } = window.Clay;

  const body = document.body;
  const slug = body.dataset.slug;
  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  const loading = document.getElementById("loading");
  const playSub = document.getElementById("playSub");
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
    if (playSub) playSub.textContent = "没能加载这个游戏";
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

  if (fullscreenBtn) {
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
  }

  document.addEventListener("fullscreenchange", () => {
    const isFull = Boolean(document.fullscreenElement);
    const label = fullscreenBtn && fullscreenBtn.querySelector(".label");
    if (label) label.textContent = isFull ? "退出全屏" : "全屏";
  });

  if (restartBtn) restartBtn.addEventListener("click", restartGame);

  (async function boot() {
    try {
      game = await api(`/api/games/${encodeURIComponent(slug)}`);
      if (playSub) {
        playSub.textContent = [game.category, game.age].filter(Boolean).join(" · ");
      }
      startGame();
    } catch (error) {
      showError(
        error.status === 404
          ? "这个游戏可能被下架了，或者链接不对。"
          : error.message || "网络不太稳定，刷新试试。"
      );
    }
  })();
})();
