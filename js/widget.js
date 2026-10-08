window.Tuk = window.Tuk || {};

Tuk.widget = (function () {
  const { fmt } = Tuk;
  const SIZE = { width: 320, height: 480 };
  const MINI = { width: 320, height: 76 };
  const MINI_KEY = "tuk.widget.mini.v1";
  let pip = null;
  let root = null;
  let mini = false;

  try { mini = localStorage.getItem(MINI_KEY) === "1"; } catch (e) {}

  const ICON = {
    fold: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5 10 7.5l5 5"/></svg>',
    unfold: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5 10 12.5l5-5"/></svg>',
    close: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>'
  };

  function supported() {
    return "documentPictureInPicture" in window;
  }

  function copyStyles(doc) {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        const css = Array.from(sheet.cssRules).map(r => r.cssText).join("\n");
        const style = doc.createElement("style");
        style.textContent = css;
        doc.head.appendChild(style);
      } catch (e) {
        if (sheet.href) {
          const link = doc.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          doc.head.appendChild(link);
        }
      }
    });
  }

  function shell() {
    root.innerHTML =
      '<header class="wg-head"><span class="brand">툭</span><span class="wg-clock" data-w="clock"></span>' +
        '<button type="button" class="ic" data-w="fold"></button>' +
        '<button type="button" class="ic" data-w="close" aria-label="위젯 닫기" title="위젯 닫기">' + ICON.close + "</button>" +
      "</header>" +
      '<button type="button" class="wg-bar" data-w="bar" aria-label="위젯 펼치기"></button>' +
      '<section class="wg-next" data-w="next"></section>' +
      '<section class="wg-sec"><h3 class="rp-title">오늘 남은 일정</h3><div data-w="events"></div></section>' +
      '<section class="wg-sec"><h3 class="rp-title">할 일</h3><div data-w="tasks"></div></section>' +
      '<form class="wg-add" data-w="add"><input autocomplete="off" placeholder="툭 던져 두기: 4시 팀 회의" aria-label="한 줄 추가"><button type="submit" class="btn">추가</button></form>' +
      '<p class="wg-msg" data-w="msg" aria-live="polite"></p>';
    root.addEventListener("change", e => {
      const id = e.target.dataset.toggle;
      if (id) Tuk.store.toggle(id);
    });
    root.addEventListener("click", e => {
      if (e.target.closest('[data-w="fold"], [data-w="bar"]')) { setMini(!mini); return; }
      if (e.target.closest('[data-w="close"]')) { close(); return; }
      const o = e.target.closest("[data-open]");
      if (o) {
        Tuk.detail.open(o.dataset.open);
        try { window.focus(); } catch (err) {}
      }
    });
    root.querySelector('[data-w="add"]').addEventListener("submit", async e => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      try {
        const r = await Tuk.capture.analyzeLine(text);
        const items = r.items.length ? r.items : [{ type: "task", title: text }];
        const added = Tuk.store.addMany(items.map(it => Object.assign({ source: "widget" }, it)));
        input.value = "";
        const msg = root.querySelector('[data-w="msg"]');
        msg.textContent = added.map(a => a.title).join(", ") + " 추가했어요";
        setTimeout(() => { if (msg.isConnected) msg.textContent = ""; }, 3000);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
  }

  function setMini(v) {
    mini = v;
    try { localStorage.setItem(MINI_KEY, v ? "1" : "0"); } catch (e) {}
    applyMini();
    if (pip) {
      const size = v ? MINI : SIZE;
      try { pip.resizeTo(size.width, size.height); } catch (e) {}
    }
    render();
  }

  function applyMini() {
    if (!root) return;
    root.classList.toggle("is-mini", mini);
    const fold = part("fold");
    fold.innerHTML = mini ? ICON.unfold : ICON.fold;
    fold.setAttribute("aria-label", mini ? "위젯 펼치기" : "위젯 접기");
    fold.title = mini ? "펼치기" : "접기";
  }

  function part(name) {
    return root && root.querySelector('[data-w="' + name + '"]');
  }

  function render() {
    if (!root) return;
    const now = new Date();
    const st = Tuk.now.status(now);
    const next = st.current || st.next;
    const bar = part("bar");
    if (next) {
      const left = fmt.duration((st.current ? next.end : next.start) - now);
      bar.innerHTML = '<span class="wg-bar-k">' + (st.current ? "진행 중" : "다음 " + fmt.time(next.start)) + '</span><span class="wg-bar-t">' + fmt.escape(next.item.title) + '</span><span class="wg-bar-l">' + (st.current ? left + " 남음" : left) + "</span>";
    } else {
      bar.innerHTML = '<span class="wg-bar-t">남은 일정이 없어요</span>';
    }
    part("clock").textContent = now.toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
    part("next").innerHTML = next
      ? '<p class="wg-kicker">' + (st.current ? "지금 진행 중 · 남은 시간" : "다음 일정까지") + '</p><p class="wg-big">' + fmt.duration((st.current ? next.end : next.start) - now) + '</p><p class="wg-sub">' + fmt.escape((st.current ? fmt.time(next.start) + "–" + fmt.time(next.end) : fmt.shortDate(next.start)) + " · " + next.item.title) + "</p>"
      : '<p class="wg-kicker">다음 일정</p><p class="wg-big is-quiet">잡힌 일정이 없어요</p>';
    const dayEnd = new Date(fmt.startOfDay(now).getTime() + 86400000);
    const today = st.list.filter(x => x.end > now && x.start < dayEnd);
    const pastCount = st.list.filter(x => x.end <= now && fmt.dayKey(x.start) === fmt.dayKey(now)).length;
    part("events").innerHTML = (today.length
      ? '<ul class="wg-list">' + today.map(x =>
          '<li><button type="button" class="wg-ev' + (x.start <= now ? " is-now" : "") + '" data-open="' + x.item.id + '"><span class="ag-time">' + fmt.time(x.start) + '</span><span class="wg-t">' + fmt.escape(x.item.title) + "</span></button></li>").join("") + "</ul>"
      : '<p class="empty">오늘 남은 일정이 없어요.</p>') +
      (pastCount ? '<p class="wg-note">지난 일정 ' + pastCount + "개</p>" : "");
    const tasks = Tuk.store.all().filter(it => it.type === "task" && !it.done).filter(it => {
      const g = Tuk.sidebar.groupOf(it, now);
      return g === "overdue" || g === "today";
    }).sort((a, b) => fmt.parse(a.due) - fmt.parse(b.due));
    part("tasks").innerHTML = tasks.length
      ? '<ul class="wg-list">' + tasks.map(it => {
          const late = fmt.parse(it.due) < now;
          return '<li class="wg-task"><input type="checkbox" class="ag-check" data-toggle="' + it.id + '" aria-label="완료"><button type="button" class="wg-t" data-open="' + it.id + '">' + fmt.escape(it.title) + '</button><span class="tk-due' + (late ? " is-late" : "") + '">' + (late ? "지남" : fmt.escape(Tuk.sidebar.dueLabel(it))) + "</span></li>";
        }).join("") + "</ul>"
      : '<p class="empty">오늘 마감인 할 일이 없어요.</p>';
  }

  function syncButtons() {
    document.querySelectorAll('[data-act="widget"]').forEach(b => { b.textContent = pip ? "위젯 닫기" : "화면에 띄우기"; });
  }

  async function open() {
    if (pip) { close(); return; }
    if (!supported()) {
      if (Tuk.drag) Tuk.drag.toast("이 브라우저는 화면에 띄우기를 지원하지 않아요");
      return;
    }
    try {
      pip = await window.documentPictureInPicture.requestWindow(mini ? MINI : SIZE);
    } catch (err) {
      pip = null;
      if (Tuk.drag) Tuk.drag.toast("위젯을 열지 못했어요. 버튼을 다시 눌러 주세요.");
      return;
    }
    const doc = pip.document;
    doc.documentElement.lang = "ko";
    doc.title = "툭 위젯";
    copyStyles(doc);
    doc.body.className = "wg-body";
    root = doc.createElement("div");
    root.className = "wg";
    doc.body.appendChild(root);
    shell();
    applyMini();
    pip.addEventListener("pagehide", () => {
      pip = null;
      root = null;
      syncButtons();
    });
    render();
    syncButtons();
  }

  function close() {
    if (pip) pip.close();
  }

  function mount() {
    document.addEventListener("click", e => {
      if (e.target.closest('[data-act="widget"]')) open();
    });
    Tuk.store.subscribe(render);
    setInterval(render, 30000);
    syncButtons();
  }

  return { mount, open, close, render, supported, setMini, isOpen: () => Boolean(pip), isMini: () => mini };
})();
