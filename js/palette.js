window.Tuk = window.Tuk || {};

Tuk.palette = (function () {
  const { fmt, store, parser, cal } = Tuk;
  let dialog;
  let input;
  let list;
  let results = [];
  let active = 0;
  let busy = false;

  const COMMANDS = [
    { label: "일간 보기", key: "D", words: "일간 하루 day", run: () => cal.setView("day") },
    { label: "주간 보기", key: "W", words: "주간 week", run: () => cal.setView("week") },
    { label: "월간 보기", key: "M", words: "월간 달력 month", run: () => cal.setView("month") },
    { label: "오늘로 이동", key: "T", words: "오늘 today", run: () => cal.goToday() },
    { label: "화면에 띄우기 (위젯)", key: "", words: "위젯 띄우기 pip widget", run: () => Tuk.widget && Tuk.widget.open() },
    { label: "회의 메모 붙여넣기", key: "", words: "회의 메모 memo", run: () => Tuk.capture.setMode("memo") },
    { label: "사이드바 접기/펴기", key: "[", words: "사이드바 sidebar", run: () => Tuk.app.toggleSidebar() },
    { label: "오늘 패널 접기/펴기", key: "]", words: "패널 오늘 panel", run: () => Tuk.app.togglePanel() },
    { label: "설정 열기", key: "", words: "설정 ai 키 settings", run: () => document.getElementById("openSettings").click() },
    { label: "단축키 보기", key: "?", words: "단축키 도움말 shortcuts", run: () => Tuk.shortcuts && Tuk.shortcuts.open() }
  ];

  function whenText(it) {
    const d = fmt.parse(it.type === "event" ? it.start : it.due);
    if (!d) return it.type === "event" ? "시간 미정" : "마감 없음";
    if (it.allDay) return fmt.shortDate(d).replace(/\s\d{2}:\d{2}$/, "") + " 종일";
    return (it.type === "task" ? "마감 " : "") + fmt.shortDate(d);
  }

  function build(q) {
    const out = [];
    const text = q.trim();
    if (text) {
      const parsed = parser.parse(text, new Date());
      const addRow = [];
      if (parsed.length) {
        addRow.push({
          section: "추가",
          html: '<span class="pl-add">+</span><span class="pl-main">' + parsed.map(p =>
            '<span class="kind kind-' + p.type + '">' + (p.type === "event" ? "일정" : "할 일") + "</span>" + fmt.escape(p.title) +
            '<span class="pl-sub">' + fmt.escape(whenText(Object.assign({ allDay: false }, p))) + (p.repeat ? " · " + Tuk.detail.repeatLabel(p.repeat) : "") + "</span>"
          ).join('<span class="pl-sep"></span>') + "</span><kbd>Enter</kbd>",
          run: () => addText(text)
        });
      }
      const lower = text.toLowerCase();
      const found = [];
      store.all().filter(it => it.title.toLowerCase().includes(lower)).slice(0, 6).forEach(it => {
        found.push({
          section: "찾기",
          html: '<span class="kind kind-' + it.type + '">' + (it.type === "event" ? "일정" : "할 일") + '</span><span class="pl-main">' + fmt.escape(it.title) + '<span class="pl-sub">' + fmt.escape(whenText(it)) + "</span></span>",
          run: () => openItem(it)
        });
      });
      const dated = parsed.some(p => p.start || p.due || p.repeat);
      if (dated || !found.length) out.push(...addRow, ...found);
      else out.push(...found, ...addRow);
    } else {
      const now = new Date();
      cal.occurrences(now, cal.addDays(now, 14)).filter(o => !o.item.done).slice(0, 5).forEach(o => {
        out.push({
          section: "다가오는 일정",
          html: '<span class="kind kind-' + o.kind + '">' + (o.kind === "event" ? "일정" : "할 일") + '</span><span class="pl-main">' + fmt.escape(o.item.title) + '<span class="pl-sub">' + fmt.escape(o.allDay ? fmt.dayLabel(o.start) : fmt.shortDate(o.start)) + "</span></span>",
          run: () => openItem(o.item, o.start)
        });
      });
    }
    const lower = text.toLowerCase();
    COMMANDS.filter(c => !text || (c.label + " " + c.words).toLowerCase().includes(lower)).forEach(c => {
      out.push({ section: "명령", html: '<span class="pl-main">' + c.label + "</span>" + (c.key ? "<kbd>" + c.key + "</kbd>" : ""), run: c.run });
    });
    return out;
  }

  function draw() {
    let html = "";
    let last = "";
    results.forEach((r, i) => {
      if (r.section !== last) {
        html += '<li class="pl-sec" role="presentation">' + r.section + "</li>";
        last = r.section;
      }
      html += '<li class="pl-item' + (i === active ? " is-active" : "") + '" role="option" aria-selected="' + (i === active) + '" data-i="' + i + '">' + r.html + "</li>";
    });
    if (!results.length) html = '<li class="pl-empty">찾는 항목이 없어요. 문장으로 쓰면 바로 추가할 수 있어요.</li>';
    list.innerHTML = html;
    const el = list.querySelector(".is-active");
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function update() {
    results = build(input.value);
    active = 0;
    draw();
  }

  async function addText(text) {
    if (busy) return;
    busy = true;
    input.disabled = true;
    try {
      const r = await Tuk.capture.analyzeLine(text);
      const items = r.items.length ? r.items : [{ type: "task", title: text }];
      const added = store.addMany(items.map(it => Object.assign({ source: "palette" }, it)));
      close();
      Tuk.capture.afterAdd(added);
    } finally {
      busy = false;
      input.disabled = false;
    }
  }

  function openItem(it, date) {
    close();
    const d = date || fmt.parse(it.type === "event" ? it.start : it.due);
    if (d) cal.goTo(d, [it.id]);
    Tuk.detail.open(it.id);
  }

  function run(i) {
    const r = results[i];
    if (!r) return;
    const keepOpen = r.section === "추가";
    if (!keepOpen) close();
    r.run();
  }

  function open() {
    if (dialog.open) return;
    input.value = "";
    update();
    dialog.showModal();
    input.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function mount() {
    dialog = document.createElement("dialog");
    dialog.className = "palette";
    dialog.setAttribute("aria-label", "명령 메뉴");
    dialog.innerHTML =
      '<div class="pl-box">' +
        '<div class="pl-input"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>' +
        '<input id="plInput" autocomplete="off" placeholder="찾거나, 문장으로 추가하거나, 명령을 입력하세요" aria-label="명령 메뉴 입력" aria-controls="plList"></div>' +
        '<ul class="pl-list" id="plList" role="listbox"></ul>' +
        '<p class="pl-foot"><kbd>↑</kbd><kbd>↓</kbd> 이동 <kbd>Enter</kbd> 실행 <kbd>Esc</kbd> 닫기</p>' +
      "</div>";
    document.body.appendChild(dialog);
    input = dialog.querySelector("#plInput");
    list = dialog.querySelector("#plList");
    input.addEventListener("input", update);
    input.addEventListener("keydown", e => {
      if (e.isComposing) return;
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(results.length - 1, active + 1); draw(); }
      if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
      if (e.key === "Enter") { e.preventDefault(); run(active); }
    });
    list.addEventListener("mousemove", e => {
      const li = e.target.closest(".pl-item");
      if (li && +li.dataset.i !== active) { active = +li.dataset.i; draw(); }
    });
    list.addEventListener("click", e => {
      const li = e.target.closest(".pl-item");
      if (li) run(+li.dataset.i);
    });
    dialog.addEventListener("click", e => { if (e.target === dialog) close(); });
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (dialog.open) close(); else open();
      }
    });
    document.querySelectorAll('[data-act="palette"]').forEach(b => b.addEventListener("click", open));
    const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K";
    document.querySelectorAll(".kbd-mod").forEach(k => { k.textContent = mod; });
  }

  return { mount, open, close };
})();
