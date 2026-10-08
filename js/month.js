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
          (key === cal.state.selected ? " is-selected" : "") +
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

    el.innerHTML = '<div class="mo">' + grid + "</div>";
  }

  function bind(el) {
    el.addEventListener("click", e => {
      const ch = e.target.closest(".mo-chip");
      if (ch) { Tuk.detail.open(ch.dataset.id); return; }
      const day = e.target.closest(".mo-day");
      if (day) { cal.select(day.dataset.day); Tuk.detail.openDay(day.dataset.day); }
    });
    el.addEventListener("keydown", e => {
      const day = e.target.closest(".mo-day");
      if (day && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        cal.select(day.dataset.day);
        Tuk.detail.openDay(day.dataset.day);
      }
    });
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
    if (Tuk.drag) Tuk.drag.toast(added.length + "개 추가했어요");
  }

  function bindPanel(el) {
    el.addEventListener("submit", e => {
      if (e.target.id !== "dayAdd") return;
      e.preventDefault();
      addToDay(e.target);
    });
  }

  return { render, bind, bindPanel };
})();
