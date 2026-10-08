window.Tuk = window.Tuk || {};

Tuk.drag = (function () {
  const { fmt, store } = Tuk;
  let drag = null;
  let suppressClick = false;

  function toast(text) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("p");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  function itemOf(id) {
    return store.all().find(x => x.id === id);
  }

  function begin(e, el, mode) {
    const it = itemOf(el.dataset.id);
    if (!it) return;
    drag = {
      el, mode, it,
      x0: e.clientX, y0: e.clientY,
      started: false,
      pointerId: e.pointerId,
      touch: e.pointerType === "touch",
      holdOk: e.pointerType !== "touch",
      timer: null
    };
    if (drag.touch) drag.timer = setTimeout(() => { if (drag) { drag.holdOk = true; startVisual(); } }, 350);
  }

  function startVisual() {
    if (!drag || drag.started) return;
    if (drag.it.repeat) {
      toast("반복 일정은 눌러서 시간을 바꿔 주세요.");
      cancel();
      return;
    }
    drag.started = true;
    drag.el.classList.add("is-dragging");
    document.body.classList.add("dragging");
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.started) {
      if (drag.touch && !drag.holdOk) {
        if (Math.abs(dx) + Math.abs(dy) > 8) cancel();
        return;
      }
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      startVisual();
      if (!drag) return;
    }
    e.preventDefault();
    drag.el.style.transform = "translate(" + dx + "px," + dy + "px)";
    markTarget(e);
  }

  function targetAt(e) {
    drag.el.style.visibility = "hidden";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    drag.el.style.visibility = "";
    if (!under) return null;
    return drag.mode === "week" ? under.closest(".wk-col, .wk-allcell") : under.closest(".mo-day");
  }

  function markTarget(e) {
    document.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target"));
    const t = targetAt(e);
    if (t) t.classList.add("drop-target");
  }

  function end(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    clearTimeout(drag.timer);
    if (!drag.started) { drag = null; return; }
    const t = targetAt(e);
    const it = drag.it;
    const mode = drag.mode === "week" && drag.el.classList.contains("wk-ev") ? "week" : "month";
    const dy = e.clientY - drag.y0;
    cleanup();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (!t) return;
    const isEvent = it.type === "event";
    const old = fmt.parse(isEvent ? it.start : it.due);
    if (!old) return;
    let next;
    if (mode === "week") {
      const day = fmt.parse(t.dataset.day + "T00:00");
      next = new Date(day);
      if (it.allDay) {
        next.setHours(0, 0, 0, 0);
      } else {
        const mins = old.getHours() * 60 + old.getMinutes() + Math.round(dy / Tuk.week.HOUR_PX * 4) * 15;
        next.setMinutes(Math.max(0, Math.min(23 * 60 + 45, mins)));
      }
    } else {
      next = fmt.parse(t.dataset.day + "T00:00");
      next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    }
    if (next.getTime() === old.getTime()) return;
    const delta = next - old;
    const patch = {};
    if (isEvent) {
      patch.start = fmt.toLocal(next);
      const oe = fmt.parse(it.end);
      patch.end = oe ? fmt.toLocal(new Date(oe.getTime() + delta)) : null;
    } else {
      patch.due = fmt.toLocal(next);
    }
    store.update(it.id, patch);
    toast("'" + it.title + "' → " + fmt.shortDate(next) + "로 옮겼어요.");
  }

  function cleanup() {
    if (!drag) return;
    drag.el.classList.remove("is-dragging");
    drag.el.style.transform = "";
    document.body.classList.remove("dragging");
    document.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target"));
    drag = null;
  }

  function cancel() {
    if (drag) clearTimeout(drag.timer);
    cleanup();
  }

  function bind(root, selector, mode) {
    root.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const el = e.target.closest(selector);
      if (el) begin(e, el, mode);
    });
    root.addEventListener("click", e => {
      if (suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }

  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", e => { if (e.key === "Escape") cancel(); });

  return { bind, toast };
})();
