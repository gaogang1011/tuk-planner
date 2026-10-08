window.Tuk = window.Tuk || {};

Tuk.now = (function () {
  const { fmt, store } = Tuk;
  const DEFAULT_MIN = 60;

  function spans(items) {
    const now = new Date();
    const from = new Date(fmt.startOfDay(now).getTime() - 86400000);
    const to = new Date(fmt.startOfDay(now).getTime() + 60 * 86400000);
    return Tuk.cal.occurrences(from, to, items || store.all())
      .filter(o => o.kind === "event" && !o.allDay && !o.item.done)
      .map(o => ({ item: o.item, start: o.start, end: o.end }))
      .sort((a, b) => a.start - b.start);
  }

  function status(now, items) {
    const list = spans(items || store.all());
    const current = list.find(x => x.start <= now && now < x.end) || null;
    const next = list.find(x => x.start > now) || null;
    return { list, current, next };
  }

  function freeGaps(now, list, minMin) {
    const end = new Date(fmt.startOfDay(now).getTime() + 24 * 3600000);
    const gaps = [];
    let cursor = now;
    list.forEach(x => {
      if (x.end <= cursor || x.start >= end) return;
      if (x.start > cursor) gaps.push({ start: cursor, end: x.start, until: x.item });
      if (x.end > cursor) cursor = x.end;
    });
    if (cursor < end) gaps.push({ start: cursor, end, until: null });
    return gaps.filter(g => g.end - g.start >= (minMin || 20) * 60000);
  }

  function urgency(task, now) {
    const d = fmt.parse(task.due);
    if (!d) return { score: 4, label: "" };
    if (d < now) return { score: 0, label: "마감 지남" };
    const diff = fmt.dayDiff(d, now);
    if (diff === 0) return { score: 1, label: "오늘 마감" };
    if (diff === 1) return { score: 2, label: "내일 마감" };
    return { score: 3, label: diff + "일 남음" };
  }

  function suggestions(now, items, limit) {
    return (items || store.all())
      .filter(it => it.type === "task" && !it.done)
      .map(it => ({ item: it, u: urgency(it, now) }))
      .sort((a, b) => a.u.score - b.u.score || ((fmt.parse(a.item.due) || Infinity) - (fmt.parse(b.item.due) || Infinity)))
      .slice(0, limit || 3);
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
    const free = freeGaps(now, list, 30).map(g => {
      const left = pct(g.start, w);
      const width = pct(g.end, w) - left;
      const label = width > 9 ? fmt.duration(g.end - g.start) : "";
      return '<div class="rb-free" style="left:' + left + "%;width:" + width + '%"><span>' + label + "</span></div>";
    }).join("");
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
          free +
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
    const allDay = Tuk.cal.occurrences(fmt.startOfDay(now), new Date(fmt.startOfDay(now).getTime() + 86400000)).filter(o => o.kind === "event" && o.allDay && !o.item.done).map(o => o.item);
    el.innerHTML =
      '<div class="now-head">' + headline(now, st) + "</div>" +
      (allDay.length ? '<p class="now-allday">오늘 종일: ' + allDay.map(it => fmt.escape(it.title)).join(", ") + "</p>" : "") +
      ribbon(now, st.list);
  }

  let aiBrief = null;

  function briefFacts(now) {
    const st = status(now);
    const gaps = freeGaps(now, st.list, 20);
    const events = st.list.filter(x => fmt.dayKey(x.start) === fmt.dayKey(now) && x.end > now);
    const tasks = store.all().filter(it => it.type === "task" && !it.done);
    const dueToday = tasks.filter(it => fmt.parse(it.due) && fmt.dayKey(fmt.parse(it.due)) === fmt.dayKey(now) && fmt.parse(it.due) >= now);
    const overdue = tasks.filter(it => fmt.parse(it.due) && fmt.parse(it.due) < now);
    const longest = gaps.find(g => g.end - g.start >= 60 * 60000) || gaps.slice().sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || null;
    return {
      events: events.map(x => ({ title: x.item.title, start: fmt.time(x.start), end: fmt.time(x.end) })),
      freeTime: gaps.map(g => ({ start: fmt.time(g.start), end: g.until ? fmt.time(g.end) : "24:00", minutes: Math.round((g.end - g.start) / 60000) })),
      dueToday: dueToday.map(it => it.title),
      overdue: overdue.map(it => it.title),
      topTasks: suggestions(now).map(p => ({ title: p.item.title, urgency: p.u.label || "마감 없음" })),
      longest
    };
  }

  function templateBrief(now) {
    const f = briefFacts(now);
    const parts = [];
    if (!f.events.length && !f.dueToday.length) parts.push("오늘 남은 일정과 마감은 없어요.");
    else parts.push("오늘 남은 일정 " + f.events.length + "개, 오늘 마감 " + f.dueToday.length + "개가 있어요.");
    if (f.overdue.length) parts.push("마감이 지난 할 일이 " + f.overdue.length + "개 있으니 먼저 확인하세요.");
    if (f.longest) {
      const range = fmt.time(f.longest.start) + "–" + (f.longest.until ? fmt.time(f.longest.end) : "24:00");
      parts.push("다음으로 넉넉한 빈 시간은 " + range + ", " + fmt.duration(f.longest.end - f.longest.start) + "이에요.");
      if (f.topTasks.length) parts.push("이때 '" + f.topTasks[0].title + "'부터 처리하면 좋아요.");
    }
    return parts.join(" ");
  }

  async function requestAiBrief(btn) {
    const cfg = Tuk.settings.effective();
    const now = new Date();
    btn.disabled = true;
    btn.textContent = "쓰는 중…";
    try {
      const facts = briefFacts(now);
      delete facts.longest;
      aiBrief = { day: fmt.dayKey(now), text: await Tuk.ai.briefing(cfg, facts, now), error: "" };
    } catch (err) {
      aiBrief = { day: fmt.dayKey(now), text: "", error: err.message };
    }
    const el = document.getElementById("todayBody");
    if (el) renderToday(el);
  }

  function briefHtml(now) {
    const cfg = Tuk.settings.effective();
    const useAi = aiBrief && aiBrief.day === fmt.dayKey(now) && aiBrief.text;
    return (
      '<div class="brief">' +
        '<p class="brief-text">' + fmt.escape(useAi ? aiBrief.text : templateBrief(now)) + "</p>" +
        (aiBrief && aiBrief.error ? '<p class="brief-error">' + fmt.escape(aiBrief.error) + "</p>" : "") +
        (cfg.enabled ? '<button type="button" class="brief-ai" data-brief="ai">' + (useAi ? "AI 브리핑 다시 받기" : "AI 브리핑 받기") + "</button>" : "") +
      "</div>"
    );
  }

  function agendaHtml(now, st) {
    const dayStart = fmt.startOfDay(now);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const occ = Tuk.cal.occurrences(dayStart, dayEnd).filter(o => o.kind === "event" && !o.item.done);
    const allDay = occ.filter(o => o.allDay);
    const timed = occ.filter(o => !o.allDay).sort((a, b) => a.start - b.start);
    const dueToday = store.all().filter(it => it.type === "task" && !it.done && fmt.parse(it.due) && fmt.dayKey(fmt.parse(it.due)) === fmt.dayKey(now));
    const rows = [];
    allDay.forEach(o => rows.push({ at: dayStart, html: '<button type="button" class="ag-row ag-allday" data-open="' + o.item.id + '"><span class="ag-time">종일</span><span class="ag-title">' + fmt.escape(o.item.title) + "</span></button>" }));
    let cursor = new Date(Math.max(now.getTime(), dayStart.getTime() + 9 * 3600000));
    timed.forEach(o => {
      if (o.end > now && o.start > cursor && o.start - cursor >= 30 * 60000) {
        rows.push({ at: cursor, html: '<div class="ag-row ag-free"><span class="ag-time">' + fmt.time(cursor) + '</span><span class="ag-title">빈 시간 ' + fmt.duration(o.start - cursor) + "</span></div>" });
      }
      if (o.end > cursor) cursor = o.end;
      const state = o.end <= now ? " is-past" : o.start <= now ? " is-now" : "";
      rows.push({ at: o.start, html:
        '<button type="button" class="ag-row ag-event' + state + '" data-open="' + o.item.id + '">' +
          '<span class="ag-time">' + fmt.time(o.start) + '<small>' + fmt.time(o.end) + "</small></span>" +
          '<span class="ag-title">' + fmt.escape(o.item.title) + (state === " is-now" ? '<em class="ag-badge">진행 중</em>' : "") + "</span>" +
        "</button>" });
    });
    dueToday.forEach(it => {
      const d = fmt.parse(it.due);
      const late = d.getHours() === 23 && d.getMinutes() === 59;
      rows.push({ at: late ? dayEnd : d, html:
        '<div class="ag-row ag-task' + (d < now ? " is-late" : "") + '" data-id="' + it.id + '">' +
          '<span class="ag-time">' + (late ? "오늘 중" : fmt.time(d)) + "</span>" +
          '<label class="ag-title"><input type="checkbox" class="ag-check" data-toggle="' + it.id + '" aria-label="완료"> ' + fmt.escape(it.title) + "</label>" +
        "</div>" });
    });
    rows.sort((a, b) => a.at - b.at);
    return rows.length ? '<div class="ag">' + rows.map(r => r.html).join("") + "</div>" : '<p class="empty">오늘 잡힌 일정과 마감이 없어요.</p>';
  }

  function renderToday(el) {
    const now = new Date();
    const st = status(now);
    const gaps = freeGaps(now, st.list, 20);
    const picks = suggestions(now);
    const first = gaps[0];
    let html = '<section class="rp-sec"><h3 class="rp-title">오늘 일정</h3>' + agendaHtml(now, st) + "</section>";
    html += '<section class="rp-sec"><h3 class="rp-title">빈 시간에 할 일</h3>';
    if (first) {
      const startsNow = first.start - now < 60000;
      html += '<p class="gap-lead"><strong>' + (startsNow ? "지금" : fmt.time(first.start)) + "부터 " + (first.until ? fmt.time(first.end) + "까지" : "오늘 끝까지") + "</strong> " + fmt.duration(first.end - first.start) + " 비어 있어요.</p>";
    } else {
      html += '<p class="gap-lead">오늘은 더 이상 빈 시간이 없어요.</p>';
    }
    html += picks.length
      ? '<ul class="picks">' + picks.map(p =>
          '<li class="pick" data-id="' + p.item.id + '">' +
            '<input type="checkbox" class="ag-check" data-toggle="' + p.item.id + '" aria-label="완료">' +
            '<button type="button" class="pick-title" data-open="' + p.item.id + '">' + fmt.escape(p.item.title) + "</button>" +
            (p.u.label ? '<span class="urg urg-' + p.u.score + '">' + p.u.label + "</span>" : "") +
          "</li>").join("") + "</ul>"
      : '<p class="empty">남은 할 일이 없어요.</p>';
    html += "</section>";
    html += '<section class="rp-sec"><h3 class="rp-title">브리핑</h3>' + briefHtml(now) + "</section>";
    el.innerHTML = html;
  }

  function bindPanel(el) {
    el.addEventListener("change", e => {
      const t = e.target.dataset.toggle;
      if (t) store.toggle(t);
    });
    el.addEventListener("click", e => {
      const o = e.target.closest("[data-open]");
      if (o) Tuk.detail.open(o.dataset.open);
    });
  }

  return { render, renderToday, bindPanel, requestAiBrief, templateBrief, status, spans, freeGaps, suggestions, urgency, DEFAULT_MIN };
})();
