window.Tuk = window.Tuk || {};

Tuk.cal = (function () {
  const { fmt, store } = Tuk;
  const VIEW_KEY = "tuk.view.v1";
  const state = { view: "week", cursor: fmt.startOfDay(new Date()), selected: null, highlight: [] };
  const listeners = [];

  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "week" || v === "month" || v === "day") state.view = v;
  } catch (e) {}

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function weekStart(d) {
    const x = fmt.startOfDay(d);
    return addDays(x, -((x.getDay() + 6) % 7));
  }

  function monthGridStart(d) {
    return weekStart(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function weekNumberInMonth(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Math.floor((d.getDate() + offset - 1) / 7) + 1;
  }

  function matchesRepeat(r, base, d) {
    if (r.until && fmt.dayKey(d) > r.until) return false;
    if (r.freq === "daily") return true;
    if (r.freq === "weekdays") return d.getDay() >= 1 && d.getDay() <= 5;
    const days = r.days && r.days.length ? r.days : [base.getDay()];
    if (!days.includes(d.getDay())) return false;
    if (r.interval === 2) {
      const weeks = Math.round((weekStart(d) - weekStart(base)) / (7 * 86400000));
      return weeks % 2 === 0;
    }
    return true;
  }

  function expand(it, from, to, out) {
    const s = fmt.parse(it.start);
    if (!s) return;
    const e0 = fmt.parse(it.end);
    const dur = e0 && e0 > s ? e0 - s : 60 * 60000;
    let d = fmt.startOfDay(s > from ? s : from);
    const limit = fmt.startOfDay(to);
    let guard = 0;
    while (d <= limit && guard++ < 800) {
      if (d >= fmt.startOfDay(s) && matchesRepeat(it.repeat, s, d)) {
        const st = new Date(d);
        st.setHours(s.getHours(), s.getMinutes(), 0, 0);
        const en = new Date(st.getTime() + dur);
        const visibleEnd = it.allDay ? addDays(fmt.startOfDay(st), 1) : en;
        if (st < to && visibleEnd > from) out.push({ item: it, kind: "event", start: st, end: en, allDay: it.allDay, key: it.id + "@" + fmt.dayKey(st) });
      }
      d = addDays(d, 1);
    }
  }

  function occurrences(from, to, items) {
    const out = [];
    (items || store.all()).forEach(it => {
      if (it.type === "event" && it.repeat) {
        expand(it, from, to, out);
        return;
      }
      if (it.type === "event") {
        const s = fmt.parse(it.start);
        if (!s) return;
        const e = fmt.parse(it.end) || new Date(s.getTime() + 60 * 60000);
        if (s < to && (it.allDay ? addDays(fmt.startOfDay(s), 1) : e) > from) {
          out.push({ item: it, kind: "event", start: s, end: e > s ? e : new Date(s.getTime() + 60 * 60000), allDay: it.allDay, key: it.id });
        }
      } else {
        const d = fmt.parse(it.due);
        if (d && d >= from && d < to) out.push({ item: it, kind: "task", start: d, end: d, allDay: true, key: it.id });
      }
    });
    return out.sort((a, b) => a.start - b.start);
  }

  function conflicts(candidate, limit) {
    if (!candidate || candidate.type !== "event" || candidate.allDay) return [];
    const s = fmt.parse(candidate.start);
    if (!s) return [];
    const temp = Object.assign({ id: "__candidate" }, candidate);
    const to = candidate.repeat ? addDays(s, 56) : addDays(fmt.startOfDay(s), 1);
    const mine = occurrences(s, to, [temp]).filter(o => !o.allDay);
    if (!mine.length) return [];
    const others = occurrences(fmt.startOfDay(s), addDays(to, 1)).filter(o => o.kind === "event" && !o.allDay && !o.item.done && o.item.id !== candidate.id);
    const hits = [];
    const seen = new Set();
    mine.forEach(a => {
      others.forEach(b => {
        if (a.start < b.end && b.start < a.end && !seen.has(b.key)) {
          seen.add(b.key);
          hits.push(b);
        }
      });
    });
    return hits.slice(0, limit || 3);
  }

  function setView(v) {
    state.view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    emit();
  }

  function shift(n) {
    if (state.view === "day") state.cursor = addDays(state.cursor, n);
    else if (state.view === "week") state.cursor = addDays(state.cursor, 7 * n);
    else if (state.view === "month") state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + n, 1);
    emit();
  }

  function goToday() {
    state.cursor = fmt.startOfDay(new Date());
    state.selected = fmt.dayKey(new Date());
    emit();
  }

  function goTo(date, ids) {
    state.cursor = fmt.startOfDay(date);
    state.selected = fmt.dayKey(date);
    flash(ids);
  }

  let flashTimer = null;

  function flash(ids) {
    state.highlight = ids || [];
    emit();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { state.highlight = []; emit(); }, 2500);
  }

  function select(key) {
    state.selected = key;
    emit();
  }

  function emit() {
    listeners.forEach(fn => fn(state));
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function title() {
    const c = state.cursor;
    if (state.view === "day") {
      const lbl = fmt.dayLabel(c);
      const parts = lbl.split(" · ");
      return { main: parts[parts.length - 1], sub: parts.length > 1 ? parts[0] : "" };
    }
    if (state.view === "week") {
      const ws = weekStart(c);
      const we = addDays(ws, 6);
      return {
        main: (ws.getMonth() + 1) + "월 " + weekNumberInMonth(ws) + "주차",
        sub: (ws.getMonth() + 1) + "/" + ws.getDate() + " – " + (we.getMonth() + 1) + "/" + we.getDate()
      };
    }
    return { main: c.getFullYear() + "년 " + (c.getMonth() + 1) + "월", sub: "" };
  }

  function isCurrent() {
    const now = new Date();
    if (state.view === "week") return fmt.dayKey(weekStart(now)) === fmt.dayKey(weekStart(state.cursor));
    if (state.view === "day") return fmt.dayKey(now) === fmt.dayKey(state.cursor);
    return now.getFullYear() === state.cursor.getFullYear() && now.getMonth() === state.cursor.getMonth();
  }

  const ICON = {
    menu: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg>',
    panel: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M12.5 3.5v13"/></svg>',
    prev: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>',
    next: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>'
  };

  function headerHtml() {
    const t = title();
    const views = [["day", "일"], ["week", "주"], ["month", "월"]].filter(([v]) => v !== "day" || Tuk.week.renderDay);
    return (
      '<button type="button" class="ic sb-open" data-act="toggle-sidebar" aria-label="사이드바 열기" title="사이드바 열기 ([)">' + ICON.menu + "</button>" +
      '<div class="cal-title"><h2>' + t.main + "</h2>" + (t.sub ? '<span class="cal-sub">' + t.sub + "</span>" : "") + "</div>" +
      '<div class="cal-nav">' +
        '<button type="button" class="ic" data-cal="prev" aria-label="이전" title="이전 (←)">' + ICON.prev + "</button>" +
        '<button type="button" class="chip-btn" data-cal="today"' + (isCurrent() ? ' aria-pressed="true"' : "") + ' title="오늘 (T)">오늘</button>' +
        '<button type="button" class="ic" data-cal="next" aria-label="다음" title="다음 (→)">' + ICON.next + "</button>" +
      "</div>" +
      '<div class="seg" role="tablist" aria-label="보기">' + views.map(([v, label]) =>
        '<button type="button" role="tab" class="seg-btn" data-view="' + v + '" aria-selected="' + (state.view === v) + '" title="' + label + " 보기 (" + { day: "D", week: "W", month: "M" }[v] + ')">' + label + "</button>"
      ).join("") + "</div>" +
      '<button type="button" class="ic rp-toggle" data-act="toggle-panel" aria-label="오늘 패널" title="오늘 패널 (])">' + ICON.panel + "</button>"
    );
  }

  function bindNav(el) {
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-cal]");
      if (!b) return;
      const act = b.dataset.cal;
      if (act === "prev") shift(-1);
      if (act === "next") shift(1);
      if (act === "today") goToday();
    });
  }

  return { state, conflicts, setView, shift, goToday, goTo, flash, select, subscribe, occurrences, weekStart, monthGridStart, addDays, headerHtml, ICON, bindNav };
})();
