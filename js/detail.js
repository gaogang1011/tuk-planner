window.Tuk = window.Tuk || {};

Tuk.detail = (function () {
  const { fmt, store } = Tuk;
  let dialog;
  let currentId = null;

  function html(it) {
    const isEvent = it.type === "event";
    const start = isEvent ? it.start : it.due;
    return (
      '<form method="dialog" class="detail-form">' +
        '<div class="detail-head">' +
          '<span class="kind kind-' + it.type + '">' + (isEvent ? "일정" : "할 일") + "</span>" +
          (it.repeat ? '<span class="repeat-badge">' + fmt.escape(repeatLabel(it.repeat)) + "</span>" : "") +
        "</div>" +
        '<label class="field"><span>제목</span><input name="title" required value="' + fmt.escape(it.title) + '"></label>' +
        '<label class="field"><span>' + (isEvent ? "시작" : "마감") + '</span><input name="start" type="datetime-local" value="' + fmt.escape(start || "") + '"></label>' +
        (isEvent ? '<label class="field"><span>끝 (비우면 1시간)</span><input name="end" type="datetime-local" value="' + fmt.escape(it.end || "") + '"></label>' : "") +
        (isEvent ? '<label class="check"><input type="checkbox" name="allDay"' + (it.allDay ? " checked" : "") + "> 종일</label>" : "") +
        (it.repeat ? '<p class="hint">반복 일정이라 수정하면 모든 회차에 적용돼요.</p>' : "") +
        '<div class="settings-actions">' +
          '<button type="button" class="btn-ghost danger" data-act="delete">' + (it.repeat ? "반복 전체 삭제" : "삭제") + "</button>" +
          '<button type="button" class="btn-ghost" data-act="close">닫기</button>' +
          '<button type="submit" class="btn">저장</button>' +
        "</div>" +
      "</form>"
    );
  }

  function repeatLabel(r) {
    if (!r) return "";
    if (r.freq === "daily") return "매일";
    if (r.freq === "weekdays") return "평일마다";
    if (r.freq === "weekly") return r.interval === 2 ? "격주" : "매주";
    return "반복";
  }

  let creating = null;

  function newHtml(start, end) {
    return (
      '<form method="dialog" class="detail-form">' +
        '<h2 class="settings-title">새 일정</h2>' +
        '<label class="field"><span>제목</span><input name="title" required placeholder="예: 팀 회의"></label>' +
        '<label class="field"><span>시작</span><input name="start" type="datetime-local" value="' + start + '"></label>' +
        '<label class="field"><span>끝</span><input name="end" type="datetime-local" value="' + end + '"></label>' +
        '<div class="settings-actions">' +
          '<button type="button" class="btn-ghost" data-act="close">닫기</button>' +
          '<button type="submit" class="btn">추가</button>' +
        "</div>" +
      "</form>"
    );
  }

  function openNew(start, minutes) {
    const s = new Date(start);
    const e = new Date(s.getTime() + (minutes || 60) * 60000);
    creating = true;
    currentId = null;
    dialog.innerHTML = newHtml(fmt.toLocal(s), fmt.toLocal(e));
    dialog.showModal();
    const t = dialog.querySelector("[name=title]");
    if (t) t.focus();
  }

  function open(id) {
    const it = store.all().find(x => x.id === id);
    if (!it) return;
    currentId = id;
    creating = null;
    dialog.innerHTML = html(it);
    dialog.showModal();
  }

  function mount() {
    dialog = document.createElement("dialog");
    dialog.className = "settings detail";
    document.body.appendChild(dialog);
    dialog.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (act === "close") dialog.close();
      if (act === "delete") {
        store.remove(currentId);
        dialog.close();
      }
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("submit", e => {
      e.preventDefault();
      if (creating) {
        const f = new FormData(e.target);
        const start = f.get("start") || null;
        let end = f.get("end") || null;
        if (end && start && end <= start) end = null;
        const added = store.add({ type: "event", title: f.get("title"), start, end, source: "calendar" });
        creating = null;
        dialog.close();
        if (Tuk.cal && start) Tuk.cal.flash([added.id]);
        return;
      }
      const it = store.all().find(x => x.id === currentId);
      if (!it) return dialog.close();
      const f = new FormData(e.target);
      const start = f.get("start") || null;
      const patch = { title: f.get("title") };
      if (it.type === "event") {
        patch.start = start;
        patch.end = f.get("end") || null;
        patch.allDay = f.get("allDay") === "on";
        if (patch.end && start && patch.end <= start) patch.end = null;
      } else {
        patch.due = start;
      }
      store.update(currentId, patch);
      dialog.close();
    });
  }

  return { mount, open, openNew, repeatLabel };
})();
