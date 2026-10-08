window.Tuk = window.Tuk || {};

Tuk.capture = (function () {
  const { fmt, store, parser } = Tuk;
  let mode = "line";
  let pending = [];
  let pendingSource = "";
  let lastError = "";
  let root;

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

  async function analyzeMemo(text) {
    lastError = "";
    const cfg = Tuk.settings.effective();
    const now = new Date();
    let result;
    if (cfg.enabled) {
      try {
        result = { items: await Tuk.ai.extractMemo(cfg, text, now), source: "ai" };
      } catch (err) {
        lastError = err.message;
      }
    }
    if (!result) result = { items: parser.extractMemo(text, now, cfg.myName), source: cfg.enabled ? "rule-fallback" : "rule" };
    if (!result.items.length) lastError = "메모에서 할 일이나 일정을 찾지 못했어요. 할 일은 \"~하기\", \"~까지\"처럼 적으면 더 잘 찾아요.";
    return result;
  }

  function sourceLabel(src) {
    if (src === "ai") return "AI가 정리했어요";
    if (src === "rule-fallback") return (lastError ? lastError + " " : "") + "기본 규칙으로 대신 정리했어요";
    return "기본 규칙으로 정리했어요";
  }

  function render() {
    root.innerHTML =
      '<div class="modes" role="tablist" aria-label="입력 방식">' +
        '<button type="button" role="tab" class="mode" data-mode="line" aria-selected="' + (mode === "line") + '">한 줄</button>' +
        '<button type="button" role="tab" class="mode" data-mode="memo" aria-selected="' + (mode === "memo") + '">회의 메모</button>' +
      "</div>" +
      (mode === "line" ? lineForm() : memoForm()) +
      '<p class="capture-error" id="captureError" aria-live="polite"></p>' +
      '<div class="preview" id="preview" aria-live="polite"></div>';
    renderPreview();
  }

  function lineForm() {
    return (
      '<form class="quick" id="quickForm">' +
        '<label class="quick-label" for="quickInput">툭 던져 두세요</label>' +
        '<div class="quick-row">' +
          '<input id="quickInput" class="quick-input" autocomplete="off" placeholder="다음 주 화요일 3시 교수님 면담, 그 전에 자료 정리">' +
          '<button type="submit" class="btn quick-go">정리하기</button>' +
        "</div>" +
      "</form>"
    );
  }

  function memoForm() {
    return (
      '<form class="quick" id="memoForm">' +
        '<label class="quick-label" for="memoInput">회의 메모를 그대로 붙여 넣으세요</label>' +
        '<textarea id="memoInput" class="memo-input" rows="6" placeholder="- 다음 회의는 수요일 2시&#10;- 강혁: 화면 시안 금요일까지 공유&#10;- 준혁: API 문서 정리&#10;- 발표 자료는 다 같이 월요일 오전까지"></textarea>' +
        '<div class="memo-actions"><button type="submit" class="btn quick-go">할 일 뽑기</button></div>' +
      "</form>"
    );
  }

  function renderPreview() {
    const box = root.querySelector("#preview");
    const err = root.querySelector("#captureError");
    err.textContent = !pending.length ? lastError : "";
    if (!pending.length) {
      box.innerHTML = "";
      return;
    }
    const picked = pending.filter(it => it.pick).length;
    const others = pending.some(it => it.mine === false);
    box.innerHTML =
      '<p class="preview-note">' + sourceLabel(pendingSource) + ". " + (others ? "다른 사람이 맡은 일은 빼 두었어요" + (Tuk.settings.effective().myName ? ". " : " (설정에 내 이름을 넣으면 내 일을 알아봐요). ") : "") + "확인하고 추가하세요.</p>" +
      '<ul class="preview-list">' + pending.map(previewRow).join("") + "</ul>" +
      '<div class="preview-actions">' +
        '<button type="button" class="btn-ghost" data-act="cancel">취소</button>' +
        '<button type="button" class="btn" data-act="commit"' + (picked ? "" : " disabled") + ">" + picked + "개 추가</button>" +
      "</div>";
  }

  function previewRow(it, i) {
    const when = it.type === "event" ? it.start : it.due;
    return (
      '<li class="preview-row' + (it.pick ? "" : " is-off") + '" data-i="' + i + '">' +
        '<input type="checkbox" class="p-pick" data-field="pick" aria-label="추가할 항목" ' + (it.pick ? "checked" : "") + ">" +
        '<button type="button" class="kind kind-' + it.type + ' kind-toggle" data-act="toggle" title="일정/할 일 바꾸기">' + (it.type === "event" ? "일정" : "할 일") + "</button>" +
        '<span class="p-title-wrap"><input class="p-title" data-field="title" value="' + fmt.escape(it.title) + '" aria-label="제목">' +
          (it.owner ? '<span class="owner">' + fmt.escape(it.owner) + " 담당</span>" : "") +
          (it.repeat ? '<span class="owner">' + fmt.escape(Tuk.detail.repeatLabel(it.repeat)) + "</span>" : "") + "</span>" +
        '<input class="p-when" type="datetime-local" data-field="when" value="' + fmt.escape(when || "") + '" aria-label="' + (it.type === "event" ? "시작 시간" : "마감") + '">' +
        '<button type="button" class="p-del" data-act="drop" aria-label="빼기">빼기</button>' +
        conflictHtml(it) +
      "</li>"
    );
  }

  function afterAdd(added) {
    if (!added.length) return;
    const dated = added.map(it => fmt.parse(it.type === "event" ? it.start : it.due)).filter(Boolean).sort((a, b) => a - b);
    const ids = added.map(it => it.id);
    if (dated.length && Tuk.cal && Tuk.cal.state.view !== "today") {
      Tuk.cal.goTo(dated[0], ids);
    }
    if (Tuk.drag) {
      Tuk.drag.toast(added.length + "개 추가했어요" + (dated.length ? " · " + fmt.shortDate(dated[0]).replace(/\s\d{2}:\d{2}$/, "") + (dated.length > 1 ? " 외" : "") : ""));
    }
  }

  function conflictHtml(it) {
    if (it.type !== "event" || !Tuk.cal) return "";
    const hits = Tuk.cal.conflicts(it, 50);
    if (!hits.length) return "";
    const groups = [];
    hits.forEach(h => {
      const g = groups.find(x => x.id === h.item.id);
      if (g) g.count++;
      else groups.push({ id: h.item.id, first: h, count: 1 });
    });
    return '<p class="p-conflict" role="note">겹치는 일정: ' + groups.slice(0, 3).map(g =>
      fmt.escape(fmt.shortDate(g.first.start) + " " + g.first.item.title) + (g.count > 1 ? " 외 " + (g.count - 1) + "회" : "")
    ).join(", ") + "</p>";
  }

  async function submit(text, analyze, fallbackOne) {
    const go = root.querySelector(".quick-go");
    const label = go.textContent;
    if (!text.trim()) return;
    go.disabled = true;
    go.textContent = "정리 중…";
    try {
      const r = await analyze(text);
      pending = r.items.map(it => Object.assign({ pick: it.mine !== false }, it));
      pendingSource = r.source;
      if (!pending.length && fallbackOne) pending = [{ type: "task", title: text.trim(), pick: true }];
      if (pending.length) {
        const field = root.querySelector("#quickInput, #memoInput");
        if (field) field.value = "";
      }
    } finally {
      go.disabled = false;
      go.textContent = label;
      renderPreview();
    }
  }

  function bind() {
    root.addEventListener("submit", e => {
      e.preventDefault();
      if (e.target.id === "quickForm") submit(root.querySelector("#quickInput").value, analyzeLine, true);
      if (e.target.id === "memoForm") submit(root.querySelector("#memoInput").value, analyzeMemo, false);
    });
    root.addEventListener("input", e => {
      const row = e.target.closest(".preview-row");
      if (!row) return;
      const it = pending[+row.dataset.i];
      if (e.target.dataset.field === "title") it.title = e.target.value;
      if (e.target.dataset.field === "pick") { it.pick = e.target.checked; renderPreview(); }
      if (e.target.dataset.field === "when") {
        const v = e.target.value || null;
        if (it.type === "event") { it.start = v; it.allDay = false; it.end = null; } else it.due = v;
        const old = row.querySelector(".p-conflict");
        if (old) old.remove();
        row.insertAdjacentHTML("beforeend", conflictHtml(it));
      }
    });
    root.addEventListener("click", e => {
      if (e.target.dataset.mode && e.target.dataset.mode !== mode) {
        mode = e.target.dataset.mode;
        pending = [];
        lastError = "";
        render();
        const field = root.querySelector("#quickInput, #memoInput");
        if (field) field.focus();
        return;
      }
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
        const source = mode === "memo" ? "meeting" : "quick";
        const added = store.addMany(pending.filter(it => it.pick).map(it => Object.assign({ source }, it)));
        afterAdd(added);
        pending = [];
        renderPreview();
        const field = root.querySelector("#quickInput, #memoInput");
        if (field) field.focus();
      }
    });
  }

  function mount(el) {
    root = el;
    render();
    bind();
  }

  function setMode(m) {
    if (m !== mode) {
      mode = m;
      pending = [];
      lastError = "";
      render();
    }
    const field = root.querySelector("#quickInput, #memoInput");
    if (field) field.focus();
  }

  return { mount, analyzeLine, afterAdd, setMode };
})();
