window.Tuk = window.Tuk || {};

Tuk.capture = (function () {
  const { fmt, store, parser } = Tuk;
  let pending = [];
  let pendingSource = "";
  let root;

  let lastError = "";

  async function analyzeLine(text) {
    lastError = "";
    const cfg = Tuk.settings.effective();
    if (cfg.enabled) {
      try {
        const items = await Tuk.ai.parseLine(cfg, text, new Date());
        if (items.length) return { items, source: "ai" };
        lastError = "AI가 항목을 찾지 못했어요.";
      } catch (err) {
        lastError = err.message;
      }
      return { items: parser.parse(text), source: "rule-fallback" };
    }
    return { items: parser.parse(text), source: "rule" };
  }

  function sourceLabel(src) {
    if (src === "ai") return "AI가 정리했어요";
    if (src === "rule-fallback") return (lastError ? lastError + " " : "") + "기본 규칙으로 대신 정리했어요";
    return "기본 규칙으로 정리했어요";
  }

  function render() {
    root.innerHTML =
      '<form class="quick" id="quickForm">' +
        '<label class="quick-label" for="quickInput">툭 던져 두세요</label>' +
        '<div class="quick-row">' +
          '<input id="quickInput" class="quick-input" autocomplete="off" placeholder="다음 주 화요일 3시 교수님 면담, 그 전에 자료 정리">' +
          '<button type="submit" class="btn quick-go">정리하기</button>' +
        "</div>" +
      "</form>" +
      '<div class="preview" id="preview" aria-live="polite"></div>';
    renderPreview();
  }

  function renderPreview() {
    const box = root.querySelector("#preview");
    if (!pending.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML =
      '<p class="preview-note">' + sourceLabel(pendingSource) + ". 확인하고 추가하세요.</p>" +
      '<ul class="preview-list">' + pending.map(previewRow).join("") + "</ul>" +
      '<div class="preview-actions">' +
        '<button type="button" class="btn-ghost" data-act="cancel">취소</button>' +
        '<button type="button" class="btn" data-act="commit">' + pending.length + "개 추가</button>" +
      "</div>";
  }

  function previewRow(it, i) {
    const when = it.type === "event" ? it.start : it.due;
    return (
      '<li class="preview-row" data-i="' + i + '">' +
        '<button type="button" class="kind kind-' + it.type + ' kind-toggle" data-act="toggle" title="일정/할 일 바꾸기">' + (it.type === "event" ? "일정" : "할 일") + "</button>" +
        '<input class="p-title" data-field="title" value="' + fmt.escape(it.title) + '" aria-label="제목">' +
        '<input class="p-when" type="datetime-local" data-field="when" value="' + fmt.escape(when || "") + '" aria-label="' + (it.type === "event" ? "시작 시간" : "마감") + '">' +
        '<button type="button" class="p-del" data-act="drop" aria-label="빼기">빼기</button>' +
      "</li>"
    );
  }

  async function submit(text) {
    const input = root.querySelector("#quickInput");
    const go = root.querySelector(".quick-go");
    if (!text.trim()) return;
    go.disabled = true;
    go.textContent = "정리 중…";
    try {
      const r = await analyzeLine(text);
      pending = r.items;
      pendingSource = r.source;
      if (!pending.length) {
        pending = [{ type: "task", title: text.trim() }];
      }
      input.value = "";
    } finally {
      go.disabled = false;
      go.textContent = "정리하기";
      renderPreview();
    }
  }

  function bind() {
    root.addEventListener("submit", e => {
      if (e.target.id !== "quickForm") return;
      e.preventDefault();
      submit(root.querySelector("#quickInput").value);
    });
    root.addEventListener("input", e => {
      const row = e.target.closest(".preview-row");
      if (!row) return;
      const it = pending[+row.dataset.i];
      if (e.target.dataset.field === "title") it.title = e.target.value;
      if (e.target.dataset.field === "when") {
        const v = e.target.value || null;
        if (it.type === "event") { it.start = v; it.allDay = false; it.end = null; } else it.due = v;
      }
    });
    root.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if (!act) return;
      const row = e.target.closest(".preview-row");
      if (act === "toggle" && row) {
        const it = pending[+row.dataset.i];
        if (it.type === "event") { it.type = "task"; it.due = it.start || null; }
        else { it.type = "event"; it.start = it.due || null; }
        renderPreview();
      } else if (act === "drop" && row) {
        pending.splice(+row.dataset.i, 1);
        renderPreview();
      } else if (act === "cancel") {
        pending = [];
        renderPreview();
      } else if (act === "commit") {
        store.addMany(pending.map(it => Object.assign({ source: "quick" }, it)));
        pending = [];
        renderPreview();
        root.querySelector("#quickInput").focus();
      }
    });
  }

  function mount(el) {
    root = el;
    render();
    bind();
  }

  return { mount };
})();
