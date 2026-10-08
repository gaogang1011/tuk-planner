window.Tuk = window.Tuk || {};

Tuk.week = (function () {
  const { fmt, cal } = Tuk;
  const HOUR_PX = 48;
  const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

  function lanes(list) {
    const sorted = list.slice().sort((a, b) => a.start - b.start || b.end - a.end);
    const placed = [];
    let cluster = [];
    let clusterEnd = 0;
    function flush() {
      const cols = [];
      cluster.forEach(o => {
        let c = cols.findIndex(end => end <= o.start);
        if (c === -1) { c = cols.length; cols.push(0); }
        cols[c] = o.end;
        o.col = c;
      });
      cluster.forEach(o => { o.cols = cols.length; placed.push(o); });
      cluster = [];
    }
    sorted.forEach(o => {
      if (cluster.length && o.start >= clusterEnd) flush();
      cluster.push(o);
      clusterEnd = Math.max(clusterEnd, o.end.getTime());
    });
    if (cluster.length) flush();
    return placed;
  }

  function range(days, occ) {
    let startH = 7;
    let endH = 24;
    occ.forEach(o => {
      if (o.allDay) return;
      startH = Math.min(startH, o.start.getHours());
    });
    return { startH, endH };
  }

  function y(d, startH) {
    return ((d.getHours() - startH) * 60 + d.getMinutes()) / 60 * HOUR_PX;
  }

  const mobile = window.matchMedia ? window.matchMedia("(max-width: 700px)") : { matches: false };

  function freeOf(d, timed, now) {
    const free = [];
    const dayStart = new Date(d.getTime() + 9 * 3600000);
    const dayEnd = new Date(d.getTime() + 21 * 3600000);
    let cursor = now > dayStart ? new Date(Math.ceil(now.getTime() / 1800000) * 1800000) : dayStart;
    timed.slice().sort((a, b) => a.start - b.start).forEach(o => {
      if (o.end <= cursor || o.start >= dayEnd) return;
      if (o.start > cursor) free.push([cursor, o.start < dayEnd ? o.start : dayEnd]);
      if (o.end > cursor) cursor = o.end;
    });
    if (cursor < dayEnd) free.push([cursor, dayEnd]);
    return free.filter(([a, b]) => b - a >= 60 * 60000);
  }

  function renderMobile(el) {
    const now = new Date();
    const ws = cal.weekStart(cal.state.cursor);
    const occ = cal.occurrences(ws, cal.addDays(ws, 7));
    const hl = cal.state.highlight || [];
    let strip = "";
    let cards = "";
    for (let i = 0; i < 7; i++) {
      const d = cal.addDays(ws, i);
      const key = fmt.dayKey(d);
      const holiday = Tuk.holidays.get(key);
      const isToday = key === fmt.dayKey(now);
      const list = occ.filter(o => fmt.dayKey(o.start) === key);
      const timed = list.filter(o => o.kind === "event" && !o.allDay);
      const busyMin = timed.reduce((sum, o) => sum + (o.end - o.start) / 60000, 0);
      const dayClass = (i === 5 ? " is-sat" : "") + (i === 6 || holiday ? " is-sun" : "") + (isToday ? " is-today" : "");
      strip += '<a class="ws-day' + dayClass + '" href="#wd-' + key + '"><span class="wk-dow">' + WEEK[i] + '</span><span class="wk-date">' + d.getDate() + '</span><span class="wk-loadbar"><span style="width:' + Math.min(100, busyMin / 6) + '%"></span></span></a>';
      const rows = list.slice().sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.start - b.start).map(o =>
        '<li><button type="button" class="wm-item wm-' + o.kind + (o.item.done ? " is-done" : "") + (hl.includes(o.item.id) ? " is-new" : "") + '" data-id="' + o.item.id + '">' +
          '<span class="mp-time">' + (o.kind === "task" ? "마감" : o.allDay ? "종일" : fmt.time(o.start) + "–" + fmt.time(o.end)) + "</span>" +
          '<span class="mp-title">' + fmt.escape(o.item.title) + "</span></button></li>"
      ).join("");
      const free = freeOf(d, timed, now).map(([a, b]) => '<li class="wm-free">빈 ' + fmt.time(a) + "–" + fmt.time(b) + " · " + fmt.duration(b - a) + "</li>").join("");
      cards +=
        '<section class="wm-card' + dayClass + '" id="wd-' + key + '">' +
          '<header class="wm-head"><h3>' + fmt.escape(fmt.dayLabel(d)) + "</h3>" +
            '<span class="wk-load">' + (holiday ? '<span class="wk-holiday">' + holiday + "</span> " : "") + (timed.length ? "일정 " + timed.length + " · " + fmt.duration(busyMin * 60000) : "비어 있음") + "</span>" +
            '<button type="button" class="wm-add" data-add="' + key + '" aria-label="' + fmt.escape(fmt.dayLabel(d)) + '에 추가">+</button>' +
          "</header>" +
          (rows || free ? '<ul class="wm-list">' + rows + free + "</ul>" : "") +
        "</section>";
    }
    el.innerHTML = cal.headerHtml() + '<nav class="ws-strip" aria-label="요일">' + strip + "</nav>" + '<div class="wm">' + cards + "</div>";
  }

  function render(el) {
    if (mobile.matches) return renderMobile(el);
    const now = new Date();
    const ws = cal.weekStart(cal.state.cursor);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(cal.addDays(ws, i));
    const occ = cal.occurrences(ws, cal.addDays(ws, 7));
    const { startH, endH } = range(days, occ);
    const height = (endH - startH) * HOUR_PX;
    const hl = cal.state.highlight || [];

    let head = '<div class="wk-corner"></div>';
    let allday = '<div class="wk-corner wk-alllabel">종일</div>';
    let cols = "";
    days.forEach((d, i) => {
      const key = fmt.dayKey(d);
      const isToday = key === fmt.dayKey(now);
      const holiday = Tuk.holidays.get(key);
      const dayClass = (i === 5 ? " is-sat" : "") + (i === 6 || holiday ? " is-sun" : "") + (isToday ? " is-today" : "");
      const dayTimed = occ.filter(o => o.kind === "event" && !o.allDay && fmt.dayKey(o.start) === key);
      const busyMin = dayTimed.reduce((sum, o) => sum + (o.end - o.start) / 60000, 0);
      const load = dayTimed.length ? "일정 " + dayTimed.length + " · " + fmt.duration(busyMin * 60000) : "비어 있음";
      const loadPct = Math.min(100, busyMin / (10 * 60) * 100);
      head += '<div class="wk-dayhead' + dayClass + '" data-day="' + key + '">' +
        '<div class="wk-daytop"><span class="wk-dow">' + WEEK[i] + '</span><span class="wk-date">' + d.getDate() + "</span></div>" +
        '<span class="wk-load">' + (holiday ? '<span class="wk-holiday">' + holiday + "</span> " : "") + load + "</span>" +
        '<span class="wk-loadbar" aria-hidden="true"><span style="width:' + loadPct + '%"></span></span>' +
      "</div>";
      const chips = occ.filter(o => o.allDay && fmt.dayKey(o.start) === key).map(o => {
        const cls = "wk-chip wk-chip-" + o.kind + (o.item.done ? " is-done" : "") + (hl.includes(o.item.id) ? " is-new" : "");
        const label = o.kind === "task" ? (o.start.getHours() === 23 && o.start.getMinutes() === 59 ? "" : fmt.time(o.start) + " ") + o.item.title : o.item.title;
        return '<button type="button" class="' + cls + '" data-id="' + o.item.id + '" title="' + (o.kind === "task" ? "마감: " : "종일: ") + fmt.escape(o.item.title) + '">' + fmt.escape(label) + "</button>";
      }).join("");
      allday += '<div class="wk-allcell' + dayClass + '" data-day="' + key + '">' + chips + "</div>";
      const timed = occ.filter(o => o.kind === "event" && !o.allDay && fmt.dayKey(o.start) === key).map(o => {
        const dayEnd = new Date(d.getTime() + endH * 3600000);
        return Object.assign({}, o, { end: o.end > dayEnd ? dayEnd : o.end });
      });
      const blocks = lanes(timed).map(o => {
        const top = y(o.start, startH);
        const h = Math.max(22, (o.end - o.start) / 3600000 * HOUR_PX - 2);
        const w = 100 / o.cols;
        const past = o.end <= now;
        const cls = "wk-ev" + (past ? " is-past" : "") + (hl.includes(o.item.id) ? " is-new" : "") + (h < 36 ? " is-short" : "");
        return '<button type="button" class="' + cls + '" data-id="' + o.item.id + '" style="top:' + top + "px;height:" + h + "px;left:calc(" + (o.col * w) + "% + 2px);width:calc(" + w + '% - 4px)">' +
          '<span class="wk-ev-title">' + fmt.escape(o.item.title) + '</span><span class="wk-ev-time">' + fmt.time(o.start) + "–" + fmt.time(o.end) + "</span></button>";
      }).join("");
      const free = freeOf(d, timed, now);
      const freeHtml = free.map(([a, b]) =>
        '<div class="wk-free" style="top:' + (y(a, startH) + 1) + "px;height:" + ((b - a) / 3600000 * HOUR_PX - 3) + 'px"><span>빈 ' + fmt.duration(b - a) + "</span></div>"
      ).join("");
      const nowLine = isToday && now.getHours() >= startH ? '<div class="wk-now" style="top:' + y(now, startH) + 'px"></div>' : "";
      cols += '<div class="wk-col' + dayClass + '" data-day="' + key + '" data-start="' + startH + '">' + freeHtml + blocks + nowLine + "</div>";
    });

    let gutter = "";
    for (let h = startH; h < endH; h++) gutter += '<div class="wk-hour" style="top:' + ((h - startH) * HOUR_PX) + 'px">' + h + "</div>";

    el.innerHTML =
      cal.headerHtml() +
      '<div class="wk">' +
        '<div class="wk-head">' + head + "</div>" +
        '<div class="wk-allday">' + allday + "</div>" +
        '<div class="wk-scroll" id="wkScroll">' +
          '<div class="wk-body" style="height:' + height + 'px;--hour:' + HOUR_PX + 'px">' +
            '<div class="wk-gutter">' + gutter + "</div>" +
            cols +
          "</div>" +
        "</div>" +
      "</div>" +
      '<p class="wk-legend">점선은 09–21시 사이 1시간 이상 비는 시간이에요. 빈 칸을 누르면 그 시간에 일정을 추가해요.</p>';

    const scroller = el.querySelector("#wkScroll");
    const focusH = cal.state.highlight && cal.state.highlight.length
      ? Math.min.apply(null, occ.filter(o => hl.includes(o.item.id) && !o.allDay).map(o => o.start.getHours()).concat([24]))
      : (fmt.dayKey(cal.weekStart(now)) === fmt.dayKey(ws) ? now.getHours() - 1 : 9);
    scroller.scrollTop = Math.max(0, (Math.min(focusH, 22) - startH) * HOUR_PX);
  }

  function bind(el) {
    el.addEventListener("click", e => {
      const ev = e.target.closest(".wk-ev, .wk-chip, .wm-item");
      if (ev) { Tuk.detail.open(ev.dataset.id); return; }
      const add = e.target.closest("[data-add]");
      if (add) {
        const d = fmt.parse(add.dataset.add + "T00:00");
        const now = new Date();
        d.setHours(fmt.dayKey(d) === fmt.dayKey(now) ? Math.min(23, now.getHours() + 1) : 10, 0, 0, 0);
        Tuk.detail.openNew(d, 60);
        return;
      }
      const col = e.target.closest(".wk-col");
      if (!col) return;
      const rect = col.getBoundingClientRect();
      const mins = Math.floor((e.clientY - rect.top) / HOUR_PX * 2) * 30;
      const start = fmt.parse(col.dataset.day + "T00:00");
      start.setMinutes(+col.dataset.start * 60 + mins);
      Tuk.detail.openNew(start, 60);
    });
  }

  return { render, bind, lanes, HOUR_PX, mobile };
})();
