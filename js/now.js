window.Tuk = window.Tuk || {};

Tuk.now = (function () {
  const { fmt, store } = Tuk;
  const DEFAULT_MIN = 60;

  function spans(items) {
    return items
      .filter(it => it.type === "event" && !it.done && !it.allDay && fmt.parse(it.start))
      .map(it => {
        const s = fmt.parse(it.start);
        const e = fmt.parse(it.end) || new Date(s.getTime() + DEFAULT_MIN * 60000);
        return { item: it, start: s, end: e > s ? e : new Date(s.getTime() + DEFAULT_MIN * 60000) };
      })
      .sort((a, b) => a.start - b.start);
  }

  function status(now, items) {
    const list = spans(items || store.all());
    const current = list.find(x => x.start <= now && now < x.end) || null;
    const next = list.find(x => x.start > now) || null;
    return { list, current, next };
  }

  function windowOf(now, list) {
    const day = fmt.startOfDay(now);
    const todays = list.filter(x => fmt.dayKey(x.start) === fmt.dayKey(now));
    let startH = 7;
    todays.forEach(x => { startH = Math.min(startH, x.start.getHours()); });
    startH = Math.min(startH, now.getHours());
    const from = new Date(day.getTime() + startH * 3600000);
    const to = new Date(day.getTime() + 24 * 3600000);
    return { from, to, todays };
  }

  function pct(d, w) {
    return Math.max(0, Math.min(100, ((d - w.from) / (w.to - w.from)) * 100));
  }

  function ribbon(now, list) {
    const w = windowOf(now, list);
    const blocks = w.todays.map(x => {
      const left = pct(x.start, w);
      const width = Math.max(0.8, pct(x.end, w) - left);
      const past = x.end <= now;
      return '<div class="rb-event' + (past ? " is-past" : "") + '" style="left:' + left + "%;width:" + width + '%" title="' + fmt.escape(fmt.time(x.start) + " " + x.item.title) + '"><span>' + fmt.escape(x.item.title) + "</span></div>";
    }).join("");
    const ticks = [];
    for (let h = w.from.getHours() + (3 - (w.from.getHours() % 3)) % 3; h <= 24; h += 3) {
      const d = new Date(fmt.startOfDay(now).getTime() + h * 3600000);
      ticks.push('<span class="rb-tick" style="left:' + pct(d, w) + '%">' + (h === 24 ? "24" : h) + "</span>");
    }
    return (
      '<div class="ribbon" aria-hidden="true">' +
        '<div class="rb-track">' +
          '<div class="rb-past" style="width:' + pct(now, w) + '%"></div>' +
          blocks +
          '<div class="rb-now" style="left:' + pct(now, w) + '%"></div>' +
        "</div>" +
        '<div class="rb-ticks">' + ticks.join("") + "</div>" +
      "</div>"
    );
  }

  function headline(now, st) {
    if (st.current) {
      return (
        '<p class="now-kicker">지금 진행 중</p>' +
        '<p class="now-big">' + fmt.escape(st.current.item.title) + "</p>" +
        '<p class="now-sub">' + fmt.time(st.current.end) + "에 끝나요 · " + fmt.duration(st.current.end - now) + " 남음</p>"
      );
    }
    if (st.next) {
      const left = st.next.start - now;
      return (
        '<p class="now-kicker">다음 일정까지</p>' +
        '<p class="now-big">' + fmt.duration(left) + "</p>" +
        '<p class="now-sub">' + fmt.escape(fmt.shortDate(st.next.start)) + " · " + fmt.escape(st.next.item.title) + "</p>"
      );
    }
    return (
      '<p class="now-kicker">다음 일정</p>' +
      '<p class="now-big is-quiet">잡힌 일정이 없어요</p>' +
      '<p class="now-sub">위에 "내일 3시 팀 회의"처럼 적으면 여기에 남은 시간이 보여요.</p>'
    );
  }

  function render(el) {
    const now = new Date();
    const st = status(now);
    const allDay = store.all().filter(it => it.type === "event" && it.allDay && !it.done && fmt.parse(it.start) && fmt.dayKey(fmt.parse(it.start)) === fmt.dayKey(now));
    el.innerHTML =
      '<div class="now-head">' + headline(now, st) + "</div>" +
      (allDay.length ? '<p class="now-allday">오늘 종일: ' + allDay.map(it => fmt.escape(it.title)).join(", ") + "</p>" : "") +
      ribbon(now, st.list);
  }

  return { render, status, spans, DEFAULT_MIN };
})();
