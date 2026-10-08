(function () {
  const { store, views } = Tuk;
  const clock = document.getElementById("clock");
  const upcoming = document.getElementById("upcoming");
  const capture = document.getElementById("capture");
  const nowEl = document.getElementById("now");
  const todayEl = document.getElementById("today");
  const viewToday = document.getElementById("viewToday");
  const viewWeek = document.getElementById("viewWeek");
  const viewMonth = document.getElementById("viewMonth");
  const cal = Tuk.cal;

  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleString("ko-KR", {
      month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function render() {
    const v = cal.state.view;
    viewToday.hidden = v !== "today";
    viewWeek.hidden = v !== "week";
    viewMonth.hidden = v !== "month";
    document.querySelectorAll(".viewtab").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
    if (v === "today") {
      Tuk.now.render(nowEl);
      Tuk.now.renderToday(todayEl);
      views.renderList(upcoming);
    } else if (v === "week") {
      cal.renderWeek(viewWeek);
    } else {
      cal.renderMonth(viewMonth);
    }
  }

  document.querySelector(".viewnav").addEventListener("click", e => {
    const b = e.target.closest("[data-view]");
    if (b) cal.setView(b.dataset.view);
  });

  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, select, dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (cal.state.view === "today") return;
    if (e.key === "ArrowLeft") cal.shift(-1);
    if (e.key === "ArrowRight") cal.shift(1);
    if (e.key === "t" || e.key === "T") cal.goToday();
  });

  Tuk.settings.mount(document.getElementById("openSettings"));
  Tuk.capture.mount(capture);
  views.bindList(upcoming, render);
  views.bindList(todayEl, render);
  todayEl.addEventListener("click", e => {
    if (e.target.dataset.brief === "ai") Tuk.now.requestAiBrief(e.target);
  });
  cal.bindNav(viewWeek);
  cal.bindNav(viewMonth);
  cal.subscribe(render);
  store.subscribe(render);
  render();
  tick();
  setInterval(() => { tick(); if (cal.state.view !== "month") render(); }, 30000);
})();
