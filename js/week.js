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

  function render(el) {
    const now = new Date();
    const ws = cal.weekStart(cal.state.cursor);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(cal.addDays(ws, i));
    const occ = cal.occurrences(ws, cal.addDays(ws, 7));
    const { startH, endH } = range(days, occ);
    const height = (endH - startH) * HOUR_PX;
    const hl = cal.state.highlight || [];

    let head = '<div class="wk-corner"></div>';
    let cols = "";
    days.forEach((d, i) => {
      const key = fmt.dayKey(d);
      const isToday = key === fmt.dayKey(now);
      const dayClass = (i === 5 ? " is-sat" : "") + (i === 6 ? " is-sun" : "") + (isToday ? " is-today" : "");
      head += '<div class="wk-dayhead' + dayClass + '" data-day="' + key + '"><span class="wk-dow">' + WEEK[i] + '</span><span class="wk-date">' + d.getDate() + "</span></div>";
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
      const nowLine = isToday && now.getHours() >= startH ? '<div class="wk-now" style="top:' + y(now, startH) + 'px"></div>' : "";
      cols += '<div class="wk-col' + dayClass + '" data-day="' + key + '">' + blocks + nowLine + "</div>";
    });

    let gutter = "";
    for (let h = startH; h < endH; h++) gutter += '<div class="wk-hour" style="top:' + ((h - startH) * HOUR_PX) + 'px">' + h + "</div>";

    el.innerHTML =
      cal.headerHtml() +
      '<div class="wk">' +
        '<div class="wk-head">' + head + "</div>" +
        '<div class="wk-scroll" id="wkScroll">' +
          '<div class="wk-body" style="height:' + height + 'px;--hour:' + HOUR_PX + 'px">' +
            '<div class="wk-gutter">' + gutter + "</div>" +
            cols +
          "</div>" +
        "</div>" +
      "</div>";

    const scroller = el.querySelector("#wkScroll");
    const focusH = cal.state.highlight && cal.state.highlight.length
      ? Math.min.apply(null, occ.filter(o => hl.includes(o.item.id) && !o.allDay).map(o => o.start.getHours()).concat([24]))
      : (fmt.dayKey(cal.weekStart(now)) === fmt.dayKey(ws) ? now.getHours() - 1 : 9);
    scroller.scrollTop = Math.max(0, (Math.min(focusH, 22) - startH) * HOUR_PX);
  }

  function bind(el) {
    el.addEventListener("click", e => {
      const ev = e.target.closest(".wk-ev");
      if (ev) Tuk.detail.open(ev.dataset.id);
    });
  }

  return { render, bind, lanes, HOUR_PX };
})();
