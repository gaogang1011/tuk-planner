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
    const sel = cal.state.selected;

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
          (key === sel ? " is-selected" : "") +
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
      cal.headerHtml() +
      '<div class="mo-wrap">' +
        '<div class="mo">' + grid + "</div>" +
        '<aside class="mo-panel" id="moPanel"></aside>' +
      "</div>";
    if (Tuk.month.renderPanel) Tuk.month.renderPanel(el.querySelector("#moPanel"));
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

  return { render, bind, renderPanel: null };
})();
