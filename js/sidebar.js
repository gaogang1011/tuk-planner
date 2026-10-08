window.Tuk = window.Tuk || {};

Tuk.sidebar = (function () {
  const { fmt, store, cal, parser } = Tuk;
  const DOW = ["월", "화", "수", "목", "금", "토", "일"];
  const COLLAPSE_KEY = "tuk.sbgroups.v1";
  let mini = null;
  let collapsed = {};
  let showDone = false;

  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}"); } catch (e) {}

  function saveCollapsed() {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch (e) {}
  }

  function visibleRange() {
    const c = cal.state.cursor;
    if (cal.state.view === "day") return [fmt.startOfDay(c), cal.addDays(fmt.startOfDay(c), 1)];
    if (cal.state.view === "week") { const ws = cal.weekStart(c); return [ws, cal.addDays(ws, 7)]; }
    return [new Date(c.getFullYear(), c.getMonth(), 1), new Date(c.getFullYear(), c.getMonth() + 1, 1)];
  }

  function syncMini() {
    const c = cal.state.cursor;
    const target = new Date(c.getFullYear(), c.getMonth(), 1);
    if (!mini || mini.syncedTo !== fmt.dayKey(target)) mini = { month: target, syncedTo: fmt.dayKey(target) };
  }

  function renderMini(el) {
    syncMini();
    const now = new Date();
    const m = mini.month;
    const gs = cal.monthGridStart(m);
    const occ = cal.occurrences(gs, cal.addDays(gs, 42));
    const busy = new Set(occ.map(o => fmt.dayKey(o.start)));
    const [rs, re] = visibleRange();
    let cells = DOW.map((d, i) => '<span class="mc-dow' + (i === 5 ? " is-sat" : i === 6 ? " is-sun" : "") + '">' + d + "</span>").join("");
    for (let i = 0; i < 42; i++) {
      const d = cal.addDays(gs, i);
      const key = fmt.dayKey(d);
      const cls = "mc-day" +
        (d.getMonth() !== m.getMonth() ? " is-out" : "") +
        (key === fmt.dayKey(now) ? " is-today" : "") +
        (cal.state.view !== "month" && d >= rs && d < re ? " is-range" : "") +
        (Tuk.holidays.get(key) || i % 7 === 6 ? " is-sun" : i % 7 === 5 ? " is-sat" : "");
      cells += '<button type="button" class="' + cls + '" data-mini="' + key + '" aria-label="' + fmt.escape(fmt.dayLabel(d)) + '">' + d.getDate() + (busy.has(key) ? '<i aria-hidden="true"></i>' : "") + "</button>";
    }
    el.innerHTML =
      '<div class="mc-head">' +
        '<span class="mc-title">' + m.getFullYear() + "년 " + (m.getMonth() + 1) + "월</span>" +
        '<button type="button" class="ic sm" data-mini-nav="-1" aria-label="이전 달">' + cal.ICON.prev + "</button>" +
        '<button type="button" class="ic sm" data-mini-nav="1" aria-label="다음 달">' + cal.ICON.next + "</button>" +
      "</div>" +
      '<div class="mc-grid">' + cells + "</div>";
  }

  function groupOf(it, now) {
    const d = fmt.parse(it.due);
    if (!d) return "none";
    if (d < now) return "overdue";
    const diff = fmt.dayDiff(d, now);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (d < cal.addDays(cal.weekStart(now), 7)) return "week";
    return "later";
  }

  const GROUPS = [
    ["overdue", "마감 지남"],
    ["today", "오늘"],
    ["tomorrow", "내일"],
    ["week", "이번 주"],
    ["later", "나중"],
    ["none", "날짜 없음"]
  ];

  function dueLabel(it) {
    const d = fmt.parse(it.due);
    if (!d) return "";
    const late = d.getHours() === 23 && d.getMinutes() === 59;
    const diff = fmt.dayDiff(d, new Date());
    if (diff === 0) return late ? "오늘" : fmt.time(d);
    if (diff === 1) return late ? "내일" : "내일 " + fmt.time(d);
    return (d.getMonth() + 1) + "/" + d.getDate() + (late ? "" : " " + fmt.time(d));
  }

  function taskRow(it) {
    return (
      '<li class="tk' + (it.done ? " is-done" : "") + '" data-id="' + it.id + '">' +
        '<input type="checkbox" class="tk-check" aria-label="완료"' + (it.done ? " checked" : "") + ">" +
        '<button type="button" class="tk-title" data-open="' + it.id + '">' + fmt.escape(it.title) + "</button>" +
        '<span class="tk-due">' + fmt.escape(dueLabel(it)) + "</span>" +
      "</li>"
    );
  }

  function renderTasks(el) {
    const now = new Date();
    const tasks = store.all().filter(it => it.type === "task");
    const open = tasks.filter(t => !t.done).sort((a, b) => (fmt.parse(a.due) || Infinity) - (fmt.parse(b.due) || Infinity));
    const done = tasks.filter(t => t.done);
    let html =
      '<div class="sb-sec-head"><span>할 일</span><span class="sb-count">' + open.length + "</span></div>" +
      '<form class="tk-add" id="tkAdd"><span aria-hidden="true">+</span><input id="tkAddInput" autocomplete="off" placeholder="할 일 추가 (예: 금요일까지 보고서)" aria-label="할 일 추가"></form>';
    GROUPS.forEach(([key, label]) => {
      const list = open.filter(t => groupOf(t, now) === key);
      if (!list.length) return;
      const closed = collapsed[key];
      html +=
        '<div class="tk-group' + (key === "overdue" ? " is-overdue" : "") + '">' +
          '<button type="button" class="tk-ghead" data-group="' + key + '" aria-expanded="' + !closed + '"><span class="tw">' + (closed ? "▸" : "▾") + "</span>" + label + '<span class="sb-count">' + list.length + "</span></button>" +
          (closed ? "" : '<ul class="tk-list">' + list.map(taskRow).join("") + "</ul>") +
        "</div>";
    });
    if (!open.length) html += '<p class="sb-empty">남은 할 일이 없어요.</p>';
    if (done.length) {
      html += '<button type="button" class="tk-ghead tk-donehead" data-done-toggle aria-expanded="' + showDone + '"><span class="tw">' + (showDone ? "▾" : "▸") + "</span>완료<span class=\"sb-count\">" + done.length + "</span></button>" +
        (showDone ? '<ul class="tk-list">' + done.slice(-30).reverse().map(taskRow).join("") + "</ul>" : "");
    }
    const focused = document.activeElement && document.activeElement.id === "tkAddInput";
    const draft = el.querySelector("#tkAddInput") ? el.querySelector("#tkAddInput").value : "";
    el.innerHTML = html;
    if (draft) el.querySelector("#tkAddInput").value = draft;
    if (focused) el.querySelector("#tkAddInput").focus();
  }

  function addTask(text) {
    const parsed = parser.parse(text, new Date());
    const items = (parsed.length ? parsed : [{ type: "task", title: text }]).map(it => {
      if (it.type === "event") return { type: "task", title: it.title, due: it.allDay ? (it.start || "").slice(0, 10) + "T23:59" : it.start, source: "sidebar" };
      return Object.assign({ source: "sidebar" }, it);
    });
    const added = store.addMany(items);
    if (Tuk.drag) Tuk.drag.toast("할 일 " + added.length + "개 추가했어요");
  }

  function mount(miniEl, tasksEl) {
    miniEl.addEventListener("click", e => {
      const nav = e.target.closest("[data-mini-nav]");
      if (nav) {
        syncMini();
        mini.month = new Date(mini.month.getFullYear(), mini.month.getMonth() + Number(nav.dataset.miniNav), 1);
        renderMini(miniEl);
        return;
      }
      const day = e.target.closest("[data-mini]");
      if (day) cal.goTo(fmt.parse(day.dataset.mini + "T00:00"), []);
    });
    tasksEl.addEventListener("change", e => {
      if (!e.target.classList.contains("tk-check")) return;
      const li = e.target.closest(".tk");
      if (li) store.toggle(li.dataset.id);
    });
    tasksEl.addEventListener("click", e => {
      const g = e.target.closest("[data-group]");
      if (g) { collapsed[g.dataset.group] = !collapsed[g.dataset.group]; saveCollapsed(); renderTasks(tasksEl); return; }
      if (e.target.closest("[data-done-toggle]")) { showDone = !showDone; renderTasks(tasksEl); return; }
      const o = e.target.closest("[data-open]");
      if (o) Tuk.detail.open(o.dataset.open);
    });
    tasksEl.addEventListener("submit", e => {
      if (e.target.id !== "tkAdd") return;
      e.preventDefault();
      const input = e.target.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      addTask(text);
    });
  }

  function render(miniEl, tasksEl) {
    renderMini(miniEl);
    renderTasks(tasksEl);
  }

  return { mount, render, groupOf, dueLabel };
})();
