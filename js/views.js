window.Tuk = window.Tuk || {};

Tuk.views = (function () {
  const { fmt, store } = Tuk;

  function itemWhen(it) {
    const d = fmt.parse(it.type === "event" ? it.start : it.due);
    if (!d) return it.type === "event" ? "시간 미정" : "마감 없음";
    return (it.type === "task" ? "~ " : "") + fmt.shortDate(d);
  }

  function itemRow(it) {
    const kind = it.type === "event" ? "일정" : "할 일";
    return (
      '<li class="item' + (it.done ? " is-done" : "") + '" data-id="' + it.id + '" data-type="' + it.type + '">' +
        '<input type="checkbox" class="item-check" aria-label="완료" ' + (it.done ? "checked" : "") + ">" +
        '<div class="item-body">' +
          '<span class="item-title">' + fmt.escape(it.title) + "</span>" +
          '<span class="item-meta"><span class="kind kind-' + it.type + '">' + kind + "</span>" + fmt.escape(itemWhen(it)) + "</span>" +
        "</div>" +
        '<button type="button" class="item-del" aria-label="삭제">삭제</button>' +
      "</li>"
    );
  }

  function sortKey(it) {
    const d = fmt.parse(it.type === "event" ? it.start : it.due);
    return d ? d.getTime() : Infinity;
  }

  function renderList(el) {
    const items = store.all().sort((a, b) => sortKey(a) - sortKey(b));
    const events = items.filter(i => i.type === "event");
    const tasks = items.filter(i => i.type === "task");
    el.innerHTML =
      '<h2 class="panel-title">일정</h2>' +
      (events.length ? '<ul class="items">' + events.map(itemRow).join("") + "</ul>" : '<p class="empty">아직 일정이 없어요.</p>') +
      '<h2 class="panel-title">할 일</h2>' +
      (tasks.length ? '<ul class="items">' + tasks.map(itemRow).join("") + "</ul>" : '<p class="empty">아직 할 일이 없어요.</p>') +
      addForm();
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

  function bindList(el) {
    el.addEventListener("change", e => {
      if (!e.target.classList.contains("item-check")) return;
      const li = e.target.closest(".item");
      if (li) store.toggle(li.dataset.id);
    });
    el.addEventListener("click", e => {
      if (!e.target.classList.contains("item-del")) return;
      const li = e.target.closest(".item");
      if (li) store.remove(li.dataset.id);
    });
    el.addEventListener("submit", e => {
      if (e.target.id !== "manualForm") return;
      e.preventDefault();
      const f = new FormData(e.target);
      const type = f.get("type");
      const when = f.get("when") || null;
      store.add({ type, title: f.get("title"), start: type === "event" ? when : null, due: type === "task" ? when : null });
    });
  }

  return { renderList, bindList, itemRow, itemWhen, sortKey };
})();
