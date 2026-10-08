window.Tuk = window.Tuk || {};

Tuk.month = (function () {
  const { fmt, cal, holidays } = Tuk;
  const WEEK = ["월", "화", "수", "목", "금", "토", "일"];
  const MAX = 3;

  function chip(o, hl) {
    const cls = "mo-chip mo-chip-" + (o.kind === "task" ? "task" : o.allDay ? "allday" : "event") +
      (o.item.done ? " is-done" : "") + (hl.includes(o.item.id) ? " is-new" : "");
    let label = o.item.title;
    if (o.kind === "event" && !o.allDay) label = '<span class="mo-time">' + fmt.time(o.start) + "</span>" + fmt.escape(o.item.title);
    else label = (o.kind === "task" ? '<span class="mo-time">마감</span>' : "") + fmt.escape(o.item.title);
    return '<button type="button" class="' + cls + '" data-id="' + o.item.id + '">' + label + "</button>";
  }

  function render(el) {
    const now = new Date();
    const c = cal.state.cursor;
    const gs = cal.monthGridStart(c);
    const ge = cal.addDays(gs, 42);
    const occ = cal.occurrences(gs, ge);
    const hl = cal.state.highlight || [];

    let grid = '<div class="mo-week mo-dows">' + WEEK.map((w, i) => '<div class="mo-dow' + (i === 5 ? " is-sat" : "") + (i === 6 ? " is-sun" : "") + '">' + w + "</div>").join("") + "</div>";
    for (let r = 0; r < 6; r++) {
      grid += '<div class="mo-week">';
      for (let i = 0; i < 7; i++) {
        const d = cal.addDays(gs, r * 7 + i);
        const key = fmt.dayKey(d);
        const holiday = holidays.get(key);
        const list = occ.filter(o => fmt.dayKey(o.start) === key)
          .sort((a, b) => (a.kind === "task") - (b.kind === "task") || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.start - b.start);
        const busyMin = list.filter(o => o.kind === "event" && !o.allDay).reduce((s, o) => s + (o.end - o.start) / 60000, 0);
        const cls = "mo-day" +
          (d.getMonth() !== c.getMonth() ? " is-out" : "") +
          (key === fmt.dayKey(now) ? " is-today" : "") +
          (key === fmt.dayKey(panelDay()) ? " is-selected" : "") +
          (i === 5 ? " is-sat" : "") + (i === 6 || holiday ? " is-sun" : "");
        const shown = list.slice(0, list.length > MAX ? MAX - 1 : MAX);
        const more = list.length - shown.length;
        grid +=
          '<div class="' + cls + '" data-day="' + key + '" role="button" tabindex="0" aria-label="' + fmt.escape(fmt.dayLabel(d) + (list.length ? ", " + list.length + "개" : "")) + '">' +
            '<div class="mo-top"><span class="mo-num">' + d.getDate() + "</span>" + (holiday ? '<span class="mo-holiday">' + holiday + "</span>" : "") + "</div>" +
            '<div class="mo-items">' + shown.map(o => chip(o, hl)).join("") +
              (more > 0 ? '<span class="mo-more">+' + more + "개</span>" : "") +
            "</div>" +
            '<div class="mo-dots" aria-hidden="true">' + list.slice(0, 4).map(o => '<span class="dot dot-' + o.kind + '"></span>').join("") + "</div>" +
            (busyMin ? '<span class="mo-busy" style="width:' + Math.min(100, busyMin / 600 * 100) + '%" aria-hidden="true"></span>' : "") +
          "</div>";
      }
      grid += "</div>";
    }

    el.innerHTML =
      '<div class="mo-wrap">' +
        '<div class="mo">' + grid + "</div>" +
        '<aside class="mo-panel" id="moPanel"></aside>' +
      "</div>";
    renderPanel(el.querySelector("#moPanel"));
  }

  function bind(el) {
    el.addEventListener("click", e => {
      const ch = e.target.closest(".mo-chip");
      if (ch) { Tuk.detail.open(ch.dataset.id); return; }
      const day = e.target.closest(".mo-day");
      if (day) cal.select(day.dataset.day);
    });
    el.addEventListener("keydown", e => {
      const day = e.target.closest(".mo-day");
      if (day && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        cal.select(day.dataset.day);
      }
    });
  }

  function panelDay() {
    const c = cal.state.cursor;
    const sel = cal.state.selected && fmt.parse(cal.state.selected + "T00:00");
    if (sel && sel.getMonth() === c.getMonth() && sel.getFullYear() === c.getFullYear()) return sel;
    const now = new Date();
    if (now.getMonth() === c.getMonth() && now.getFullYear() === c.getFullYear()) return fmt.startOfDay(now);
    return new Date(c.getFullYear(), c.getMonth(), 1);
  }

  function renderPanel(panel) {
    const d = panelDay();
    const key = fmt.dayKey(d);
    const occ = cal.occurrences(d, cal.addDays(d, 1));
    const events = occ.filter(o => o.kind === "event");
    const tasks = occ.filter(o => o.kind === "task");
    const holiday = holidays.get(key);
    const busyMin = events.filter(o => !o.allDay).reduce((s, o) => s + (o.end - o.start) / 60000, 0);
    panel.innerHTML =
      '<div class="mp-head">' +
        '<h3 class="mp-date">' + fmt.escape(fmt.dayLabel(d)) + "</h3>" +
        '<p class="mp-meta">' + (holiday ? '<span class="wk-holiday">' + holiday + "</span> · " : "") +
          (events.length ? "일정 " + events.length + (busyMin ? " · " + fmt.duration(busyMin * 60000) : "") : "일정 없음") +
          (tasks.length ? " · 마감 " + tasks.length : "") + "</p>" +
      "</div>" +
      '<form class="mp-add" id="dayAdd" data-day="' + key + '">' +
        '<input id="dayAddInput" autocomplete="off" placeholder="이날에 추가: 3시 팀 회의" aria-label="이날에 추가">' +
        '<button type="submit" class="btn">추가</button>' +
      "</form>" +
      '<p class="mp-msg" id="dayAddMsg" aria-live="polite"></p>' +
      (events.length ? '<ul class="mp-events">' + events.map(o =>
        '<li><button type="button" class="mp-ev" data-id="' + o.item.id + '">' +
          '<span class="mp-time">' + (o.allDay ? "종일" : fmt.time(o.start) + "–" + fmt.time(o.end)) + "</span>" +
          '<span class="mp-title">' + fmt.escape(o.item.title) + "</span>" +
          (o.item.repeat ? '<span class="repeat-badge">' + Tuk.detail.repeatLabel(o.item.repeat) + "</span>" : "") +
        "</button></li>").join("") + "</ul>" : "") +
      (tasks.length ? '<h4 class="day-label mp-sub">이날 마감</h4><ul class="items">' + tasks.map(o => Tuk.views.itemRow(o.item, false)).join("") + "</ul>" : "") +
      (!events.length && !tasks.length ? '<p class="empty">비어 있는 날이에요. 위 칸에 적어서 바로 추가하세요.</p>' : "");
  }

  function hasDate(text) {
    return /(오늘|내일|모레|글피|요일|욜|주말|다음\s*주|담주|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s*일\s*(뒤|후)|매주|매일|평일)/.test(text);
  }

  async function addToDay(form) {
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    const d = fmt.parse(form.dataset.day + "T00:00");
    const full = hasDate(text) ? text : (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + text;
    const r = await Tuk.capture.analyzeLine(full);
    const items = r.items.length ? r.items : [{ type: "task", title: text, due: form.dataset.day + "T23:59" }];
    const added = Tuk.store.addMany(items.map(it => Object.assign({ source: "calendar" }, it)));
    const first = added.find(it => fmt.parse(it.start || it.due));
    if (first && fmt.dayKey(fmt.parse(first.start || first.due)) !== form.dataset.day) {
      cal.goTo(fmt.parse(first.start || first.due), added.map(a => a.id));
    } else {
      cal.flash(added.map(a => a.id));
    }
    const m = document.getElementById("dayAddMsg");
    if (m) m.textContent = added.length + "개 추가했어요.";
  }

  function bindPanel(el) {
    el.addEventListener("submit", e => {
      if (e.target.id !== "dayAdd") return;
      e.preventDefault();
      addToDay(e.target);
    });
    el.addEventListener("click", e => {
      const ev = e.target.closest(".mp-ev");
      if (ev) Tuk.detail.open(ev.dataset.id);
    });
  }

  return { render, bind, bindPanel, renderPanel };
})();
