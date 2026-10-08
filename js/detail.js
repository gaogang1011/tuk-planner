window.Tuk = window.Tuk || {};

Tuk.detail = (function () {
  const { fmt, store } = Tuk;
  const peek = { mode: null, id: null, start: null, day: null };
  let host = null;

  function repeatLabel(r) {
    if (!r) return "";
    const until = r.until ? " (~" + r.until.slice(5).replace("-", "/") + ")" : "";
    if (r.freq === "daily") return "매일" + until;
    if (r.freq === "weekdays") return "평일마다" + until;
    if (r.freq === "weekly") {
      const names = ["일", "월", "화", "수", "목", "금", "토"];
      const days = (r.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => names[d]).join("·");
      return (r.interval === 2 ? "격주" : "매주") + (days ? " " + days : "") + until;
    }
    return "반복";
  }

  const SOURCE = { quick: "한 줄 입력", meeting: "회의 메모", calendar: "캘린더", sidebar: "사이드바", manual: "직접 추가", palette: "명령 메뉴", widget: "위젯" };

  function head(label) {
    return (
      '<div class="pk-head">' +
        '<button type="button" class="ic" data-peek="close" aria-label="오늘 패널로 돌아가기" title="닫기 (Esc)">' + Tuk.cal.ICON.prev + "</button>" +
        '<span class="pk-crumb">' + label + "</span>" +
      "</div>"
    );
  }

  function itemHtml(it) {
    const isEvent = it.type === "event";
    const when = isEvent ? it.start : it.due;
    const conflicts = isEvent ? Tuk.cal.conflicts(it, 3) : [];
    return (
      head(isEvent ? "일정" : "할 일") +
      '<div class="pk" data-id="' + it.id + '">' +
        (isEvent ? "" : '<label class="pk-done"><input type="checkbox" data-field="done"' + (it.done ? " checked" : "") + "> " + (it.done ? "완료함" : "완료로 표시") + "</label>") +
        '<textarea class="pk-title" data-field="title" rows="1" aria-label="제목">' + fmt.escape(it.title) + "</textarea>" +
        '<dl class="props">' +
          "<dt>종류</dt><dd>" +
            '<div class="seg pk-seg"><button type="button" class="seg-btn" data-settype="event" aria-selected="' + isEvent + '">일정</button><button type="button" class="seg-btn" data-settype="task" aria-selected="' + !isEvent + '">할 일</button></div>' +
          "</dd>" +
          "<dt>" + (isEvent ? "시작" : "마감") + '</dt><dd><input type="datetime-local" data-field="when" value="' + fmt.escape(when || "") + '"></dd>' +
          (isEvent ? '<dt>끝</dt><dd><input type="datetime-local" data-field="end" value="' + fmt.escape(it.end || "") + '"><span class="prop-hint">' + (it.end ? "" : "비우면 1시간") + "</span></dd>" : "") +
          (isEvent ? '<dt>종일</dt><dd><input type="checkbox" data-field="allDay"' + (it.allDay ? " checked" : "") + "></dd>" : "") +
          (it.repeat ? "<dt>반복</dt><dd>" + fmt.escape(repeatLabel(it.repeat)) + '<span class="prop-hint">바꾸면 모든 회차에 적용</span></dd>' : "") +
          "<dt>추가한 곳</dt><dd class=\"muted\">" + fmt.escape(SOURCE[it.source] || "직접 추가") + "</dd>" +
        "</dl>" +
        (conflicts.length ? '<p class="p-conflict">겹치는 일정: ' + conflicts.map(c => fmt.escape(fmt.shortDate(c.start) + " " + c.item.title)).join(", ") + "</p>" : "") +
        '<p class="pk-saved" aria-live="polite">바꾸면 바로 저장돼요.</p>' +
        '<div class="pk-actions">' +
          (isEvent && when ? '<button type="button" class="btn-ghost" data-peek="goto">캘린더에서 보기</button>' : "") +
          '<button type="button" class="btn-ghost danger" data-peek="delete">' + (it.repeat ? "반복 전체 삭제" : "삭제") + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function newHtml() {
    const s = peek.start;
    const e = new Date(s.getTime() + 60 * 60000);
    return (
      head("새 일정") +
      '<form class="pk" id="pkNew">' +
        '<textarea class="pk-title" name="title" rows="1" required placeholder="제목 없음" aria-label="제목"></textarea>' +
        '<dl class="props">' +
          '<dt>시작</dt><dd><input type="datetime-local" name="start" value="' + fmt.toLocal(s) + '"></dd>' +
          '<dt>끝</dt><dd><input type="datetime-local" name="end" value="' + fmt.toLocal(e) + '"></dd>' +
        "</dl>" +
        '<div class="pk-actions"><button type="button" class="btn-ghost" data-peek="close">취소</button><button type="submit" class="btn">추가</button></div>' +
      "</form>"
    );
  }

  function dayHtml() {
    const d = fmt.parse(peek.day + "T00:00");
    const occ = Tuk.cal.occurrences(d, Tuk.cal.addDays(d, 1));
    const events = occ.filter(o => o.kind === "event");
    const tasks = occ.filter(o => o.kind === "task");
    const holiday = Tuk.holidays.get(peek.day);
    const busyMin = events.filter(o => !o.allDay).reduce((sum, o) => sum + (o.end - o.start) / 60000, 0);
    return (
      head("날짜") +
      '<div class="pk">' +
        '<h2 class="pk-day">' + fmt.escape(fmt.dayLabel(d)) + "</h2>" +
        '<p class="mp-meta">' + (holiday ? '<span class="wk-holiday">' + holiday + "</span> · " : "") +
          (events.length ? "일정 " + events.length + (busyMin ? " · " + fmt.duration(busyMin * 60000) : "") : "일정 없음") +
          (tasks.length ? " · 마감 " + tasks.length : "") + "</p>" +
        '<form class="mp-add" id="dayAdd" data-day="' + peek.day + '">' +
          '<input id="dayAddInput" autocomplete="off" placeholder="이날에 추가: 3시 팀 회의" aria-label="이날에 추가">' +
          '<button type="submit" class="btn">추가</button>' +
        "</form>" +
        (events.length || tasks.length
          ? '<div class="ag">' +
              events.map(o => '<button type="button" class="ag-row ag-event" data-open="' + o.item.id + '"><span class="ag-time">' + (o.allDay ? "종일" : fmt.time(o.start) + "<small>" + fmt.time(o.end) + "</small>") + '</span><span class="ag-title">' + fmt.escape(o.item.title) + (o.item.repeat ? ' <em class="ag-badge">' + fmt.escape(repeatLabel(o.item.repeat)) + "</em>" : "") + "</span></button>").join("") +
              tasks.map(o => '<div class="ag-row ag-task"><span class="ag-time">마감</span><label class="ag-title"><input type="checkbox" class="ag-check" data-toggle="' + o.item.id + '"' + (o.item.done ? " checked" : "") + "> " + fmt.escape(o.item.title) + "</label></div>").join("") +
            "</div>"
          : '<p class="empty">비어 있는 날이에요. 위 칸에 적어서 바로 추가하세요.</p>') +
      "</div>"
    );
  }

  function render(el) {
    if (peek.mode === "item") {
      const it = store.all().find(x => x.id === peek.id);
      if (!it) { close(); return false; }
      el.innerHTML = itemHtml(it);
      fit(el.querySelector(".pk-title"));
      return true;
    }
    if (peek.mode === "new") {
      el.innerHTML = newHtml();
      const t = el.querySelector(".pk-title");
      if (t) setTimeout(() => t.focus(), 0);
      return true;
    }
    if (peek.mode === "day") {
      el.innerHTML = dayHtml();
      return true;
    }
    return false;
  }

  function fit(t) {
    if (!t) return;
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  }

  function show() {
    if (Tuk.app) {
      Tuk.app.togglePanel(true);
      Tuk.app.render();
    }
  }

  function open(id) { Object.assign(peek, { mode: "item", id, start: null, day: null }); show(); }

  function openNew(start) { Object.assign(peek, { mode: "new", id: null, start: new Date(start), day: null }); show(); }

  function openDay(key) { Object.assign(peek, { mode: "day", id: null, start: null, day: key }); show(); }

  function close() {
    peek.mode = null;
    if (Tuk.app) Tuk.app.render();
  }

  function patchFrom(it, field, input) {
    if (field === "title") return { title: input.value.replace(/\n/g, " ").trim() || it.title };
    if (field === "done") return { done: input.checked };
    if (field === "allDay") return { allDay: input.checked };
    if (field === "end") {
      const v = input.value || null;
      return { end: v && it.start && v <= it.start ? null : v };
    }
    if (field === "when") {
      const v = input.value || null;
      if (it.type === "task") return { due: v };
      const old = fmt.parse(it.start);
      const next = fmt.parse(v);
      const oldEnd = fmt.parse(it.end);
      return { start: v, end: old && next && oldEnd ? fmt.toLocal(new Date(oldEnd.getTime() + (next - old))) : it.end };
    }
    return {};
  }

  function mount(el) {
    host = el;
    el.addEventListener("input", e => {
      if (e.target.classList.contains("pk-title")) fit(e.target);
    });
    el.addEventListener("keydown", e => {
      if (e.target.classList.contains("pk-title") && e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const form = e.target.closest("form");
        if (form) form.requestSubmit();
        else e.target.blur();
      }
    });
    el.addEventListener("change", e => {
      const pk = e.target.closest(".pk[data-id]");
      const field = e.target.dataset.field;
      if (!pk || !field) return;
      const it = store.all().find(x => x.id === pk.dataset.id);
      if (!it) return;
      store.update(it.id, patchFrom(it, field, e.target));
      if (Tuk.drag) Tuk.drag.toast("저장했어요");
    });
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-peek], [data-settype]");
      if (!b) return;
      if (b.dataset.settype) {
        const it = store.all().find(x => x.id === peek.id);
        if (!it || it.type === b.dataset.settype) return;
        const when = it.type === "event" ? it.start : it.due;
        store.update(it.id, b.dataset.settype === "task" ? { type: "task", due: when } : { type: "event", start: when, end: null });
        return;
      }
      const act = b.dataset.peek;
      if (act === "close") close();
      if (act === "delete") {
        const it = store.all().find(x => x.id === peek.id);
        if (it && confirm("'" + it.title + "'을(를) 삭제할까요?")) {
          peek.mode = null;
          store.remove(it.id);
          if (Tuk.drag) Tuk.drag.toast("삭제했어요");
        }
      }
      if (act === "goto") {
        const it = store.all().find(x => x.id === peek.id);
        if (it) Tuk.cal.goTo(fmt.parse(it.start), [it.id]);
      }
    });
    el.addEventListener("submit", e => {
      if (e.target.id !== "pkNew") return;
      e.preventDefault();
      const f = new FormData(e.target);
      const title = (f.get("title") || "").toString().trim();
      if (!title) return;
      const start = f.get("start") || null;
      let end = f.get("end") || null;
      if (end && start && end <= start) end = null;
      const added = store.add({ type: "event", title, start, end, source: "calendar" });
      Object.assign(peek, { mode: "item", id: added.id });
      Tuk.cal.flash([added.id]);
    });
  }

  return { mount, render, open, openNew, openDay, close, peek, repeatLabel };
})();
