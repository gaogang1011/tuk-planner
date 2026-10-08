(function () {
  const { store, views, fmt } = Tuk;
  const cal = Tuk.cal;
  const app = document.getElementById("app");
  const head = document.getElementById("mainHead");
  const calBody = document.getElementById("calBody");
  const panel = document.getElementById("panel");
  const capture = document.getElementById("capture");
  const miniCal = document.getElementById("miniCal");
  const sbTasks = document.getElementById("sbTasks");
  const UI_KEY = "tuk.ui.v1";
  const narrow = window.matchMedia("(max-width: 1100px)");
  const phone = window.matchMedia("(max-width: 760px)");

  const ui = { sidebar: true, panel: true };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || "{}")); } catch (e) {}

  function saveUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify({ sidebar: ui.sidebar, panel: ui.panel })); } catch (e) {}
  }

  function applyLayout() {
    const sbOpen = phone.matches ? Boolean(ui.sbDrawer) : ui.sidebar;
    const rpOpen = narrow.matches ? Boolean(ui.rpDrawer) : ui.panel;
    app.classList.toggle("sb-closed", !sbOpen);
    app.classList.toggle("rp-closed", !rpOpen);
    app.classList.toggle("drawer-open", (phone.matches && ui.sbDrawer) || (narrow.matches && ui.rpDrawer));
  }

  function toggleSidebar() {
    if (phone.matches) ui.sbDrawer = !ui.sbDrawer;
    else { ui.sidebar = !ui.sidebar; saveUi(); }
    applyLayout();
  }

  function togglePanel(force) {
    if (narrow.matches) ui.rpDrawer = force === undefined ? !ui.rpDrawer : force;
    else { ui.panel = force === undefined ? !ui.panel : force; saveUi(); }
    applyLayout();
  }

  function closeDrawers() {
    ui.sbDrawer = false;
    ui.rpDrawer = false;
    applyLayout();
  }

  function renderHead() {
    head.innerHTML = cal.headerHtml();
  }

  function renderCal() {
    const v = cal.state.view;
    calBody.dataset.view = v;
    if (v === "month") Tuk.month.render(calBody);
    else if (v === "day" && Tuk.week.renderDay) Tuk.week.renderDay(calBody);
    else Tuk.week.render(calBody);
  }

  function renderPanel() {
    panel.innerHTML =
      '<div class="rp-head"><p class="rp-date" id="rpClock"></p></div>' +
      '<section class="now" id="nowCard" aria-label="지금과 다음"></section>' +
      '<section class="rp-body" id="todayBody"></section>';
    Tuk.now.render(panel.querySelector("#nowCard"));
    Tuk.now.renderToday(panel.querySelector("#todayBody"));
    tick();
  }

  function render() {
    Tuk.sidebar.render(miniCal, sbTasks);
    renderHead();
    renderCal();
    renderPanel();
    applyLayout();
  }

  function tick() {
    const el = document.getElementById("rpClock");
    if (el) el.textContent = new Date().toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
  }

  app.addEventListener("click", e => {
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "toggle-sidebar") toggleSidebar();
      if (a === "toggle-panel") togglePanel();
      if (a === "close-drawers") closeDrawers();
    }
    const v = e.target.closest("[data-view]");
    if (v && head.contains(v)) cal.setView(v.dataset.view);
  });

  document.addEventListener("keydown", e => {
    const t = e.target;
    if ((t && t.closest && t.closest("input, textarea, select, dialog, [contenteditable]")) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "ArrowLeft") cal.shift(-1);
    if (e.key === "ArrowRight") cal.shift(1);
    if (e.key === "t" || e.key === "T") cal.goToday();
  });

  Tuk.sidebar.mount(miniCal, sbTasks);
  Tuk.settings.mount(document.getElementById("openSettings"));
  Tuk.capture.mount(capture);
  views.bindList(panel, render);
  panel.addEventListener("click", e => {
    if (e.target.dataset.brief === "ai") Tuk.now.requestAiBrief(e.target);
  });
  Tuk.detail.mount();
  Tuk.drag.bind(calBody, ".wk-ev, .wk-chip, .mo-chip", "auto");
  Tuk.week.bind(calBody);
  Tuk.month.bind(calBody);
  Tuk.month.bindPanel(calBody);
  views.bindList(calBody, render);
  cal.bindNav(head);
  cal.subscribe(render);
  store.subscribe(render);
  [narrow, phone, Tuk.week.mobile].forEach(m => m.addEventListener && m.addEventListener("change", () => { closeDrawers(); render(); }));
  render();
  setInterval(() => { tick(); if (cal.state.view !== "month") renderCal(); renderPanel(); }, 30000);

  Tuk.app = { render, toggleSidebar, togglePanel, closeDrawers, ui };
})();
