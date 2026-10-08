window.Tuk = window.Tuk || {};

Tuk.views = (function () {
  const { fmt, store } = Tuk;
  let editingId = null;

  function itemDate(it) {
    return fmt.parse(it.type === "event" ? it.start : it.due);
  }

  function itemWhen(it, withDay) {
    const d = itemDate(it);
    if (!d) return it.type === "event" ? "시간 미정" : "마감 없음";
    if (it.allDay) return withDay === false ? "종일" : fmt.shortDate(d).replace(/\s\d{2}:\d{2}$/, "") + " 종일";
    let text = withDay === false ? fmt.time(d) : fmt.shortDate(d);
    const e = it.type === "event" && fmt.parse(it.end);
    if (e) text += "–" + fmt.time(e);
    return it.type === "task" ? text + "까지" : text;
  }

  function sortKey(it) {
    const d = itemDate(it);
    return d ? d.getTime() : Infinity;
  }

  function itemRow(it, withDay) {
    if (it.id === editingId) return editRow(it);
    const kind = it.type === "event" ? "일정" : "할 일";
    return (
      '<li class="item' + (it.done ? " is-done" : "") + '" data-id="' + it.id + '" data-type="' + it.type + '">' +
        '<input type="checkbox" class="item-check" aria-label="완료" ' + (it.done ? "checked" : "") + ">" +
        '<div class="item-body">' +
          '<button type="button" class="item-title" title="눌러서 수정">' + fmt.escape(it.title) + "</button>" +
          '<span class="item-meta"><span class="kind kind-' + it.type + '">' + kind + "</span>" + fmt.escape(itemWhen(it, withDay)) + "</span>" +
        "</div>" +
        '<button type="button" class="item-del" aria-label="삭제">삭제</button>' +
      "</li>"
    );
  }

  function editRow(it) {
    const when = it.type === "event" ? it.start : it.due;
    return (
      '<li class="item is-editing" data-id="' + it.id + '">' +
        '<form class="edit-form">' +
          '<select name="type" aria-label="종류">' +
            '<option value="event"' + (it.type === "event" ? " selected" : "") + ">일정</option>" +
            '<option value="task"' + (it.type === "task" ? " selected" : "") + ">할 일</option>" +
          "</select>" +
          '<input name="title" required value="' + fmt.escape(it.title) + '" aria-label="제목">' +
          '<input name="when" type="datetime-local" value="' + fmt.escape(when || "") + '" aria-label="날짜와 시간">' +
          '<div class="edit-actions"><button type="button" class="btn-ghost edit-cancel">취소</button><button type="submit" class="btn">저장</button></div>' +
        "</form>" +
      "</li>"
    );
  }

  function groupByDay(items) {
    const today = fmt.startOfDay(new Date());
    const groups = new Map();
    const overdue = [];
    const undated = [];
    items.forEach(it => {
      const d = itemDate(it);
      if (!d) { undated.push(it); return; }
      if (d < today) {
        if (it.type === "task" && !it.done) overdue.push(it);
        return;
      }
      const key = fmt.dayKey(d);
      if (!groups.has(key)) groups.set(key, { date: d, items: [] });
      groups.get(key).items.push(it);
    });
    return { overdue, groups: Array.from(groups.values()), undated };
  }

  function block(title, items, cls, withDay) {
    return (
      '<div class="day' + (cls ? " " + cls : "") + '">' +
        '<h3 class="day-label">' + title + "</h3>" +
        '<ul class="items">' + items.map(it => itemRow(it, withDay)).join("") + "</ul>" +
      "</div>"
    );
  }

  function renderList(el) {
    const items = store.all().sort((a, b) => sortKey(a) - sortKey(b));
    const { overdue, groups, undated } = groupByDay(items);
    let html = '<h2 class="panel-title">앞으로</h2>';
    if (!items.length) {
      html += '<p class="empty">위 입력창에 할 일이나 일정을 한 줄로 적어 보세요.</p>';
    }
    if (overdue.length) html += block("마감 지남", overdue, "is-overdue", true);
    groups.forEach(g => { html += block(fmt.dayLabel(g.date), g.items, "", false); });
    if (undated.length) html += block("날짜 없음", undated, "", true);
    el.innerHTML = html + addForm();
  }

  function addForm() {
    return (
      '<details class="manual">' +
        "<summary>직접 추가</summary>" +
        '<form class="manual-form" id="manualForm">' +
          '<select name="type" aria-label="종류"><option value="event">일정</option><option value="task">할 일</option></select>' +
          '<input name="title" required placeholder="제목" aria-label="제목">' +
          '<input name="when" type="datetime-local" aria-label="날짜와 시간">' +
          '<button type="submit" class="btn">추가</button>' +
        "</form>" +
      "</details>"
    );
  }

  function readForm(form) {
    const f = new FormData(form);
    const type = f.get("type");
    const when = f.get("when") || null;
    return { type, title: f.get("title"), start: type === "event" ? when : null, due: type === "task" ? when : null, allDay: false };
  }

  function bindList(el, rerender) {
    el.addEventListener("change", e => {
      if (!e.target.classList.contains("item-check")) return;
      const li = e.target.closest(".item");
      if (li) store.toggle(li.dataset.id);
    });
    el.addEventListener("click", e => {
      const li = e.target.closest(".item");
      if (e.target.classList.contains("item-del") && li) {
        store.remove(li.dataset.id);
      } else if (e.target.classList.contains("item-title") && li) {
        editingId = li.dataset.id;
        rerender();
        const input = el.querySelector(".is-editing input[name=title]");
        if (input) input.focus();
      } else if (e.target.classList.contains("edit-cancel")) {
        editingId = null;
        rerender();
      }
    });
    el.addEventListener("submit", e => {
      e.preventDefault();
      if (e.target.id === "manualForm") {
        store.add(readForm(e.target));
      } else if (e.target.classList.contains("edit-form")) {
        const id = editingId;
        editingId = null;
        const patch = readForm(e.target);
        const old = store.all().find(x => x.id === id);
        if (old && old.start !== patch.start) patch.end = null;
        store.update(id, patch);
      }
    });
  }

  return { renderList, bindList, itemRow, itemWhen, itemDate, sortKey };
})();
