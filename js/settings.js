window.Tuk = window.Tuk || {};

Tuk.settings = (function () {
  const { store, fmt } = Tuk;

  const PROVIDERS = {
    none: { label: "사용 안 함", model: "" },
    gemini: { label: "Google Gemini", model: "gemini-3.5-flash-lite", keyHelp: "https://aistudio.google.com/apikey" },
    claude: { label: "Anthropic Claude", model: "claude-haiku-5-5", keyHelp: "https://console.anthropic.com/settings/keys" }
  };

  let dialog;

  function html(s) {
    const options = Object.keys(PROVIDERS).map(k =>
      '<option value="' + k + '"' + (s.provider === k ? " selected" : "") + ">" + PROVIDERS[k].label + "</option>"
    ).join("");
    const p = PROVIDERS[s.provider] || PROVIDERS.none;
    return (
      '<form method="dialog" class="settings-form" id="settingsForm">' +
        '<h2 class="settings-title">설정</h2>' +
        '<fieldset class="field-group">' +
          "<legend>AI로 정리하기</legend>" +
          '<p class="hint">AI를 연결하면 더 자유롭게 써도 알아듣고, 회의 메모에서 할 일을 뽑아 줘요. 연결하지 않아도 기본 규칙으로 동작해요.</p>' +
          '<label class="field"><span>AI 서비스</span><select name="provider">' + options + "</select></label>" +
          '<label class="field ai-only"><span>API 키</span><input name="apiKey" type="password" autocomplete="off" value="' + fmt.escape(s.apiKey) + '" placeholder="키를 붙여 넣으세요"></label>' +
          '<label class="field ai-only"><span>모델</span><input name="model" value="' + fmt.escape(s.model) + '" placeholder="' + fmt.escape(p.model) + '"></label>' +
          '<label class="field ai-only"><span>회의 메모 속 내 이름</span><input name="myName" value="' + fmt.escape(s.myName || "") + '" placeholder="예: 강혁"></label>' +
          '<p class="hint ai-only">키는 이 브라우저에만 저장되고 GitHub나 다른 곳으로 올라가지 않아요.' +
            (p.keyHelp ? ' <a href="' + p.keyHelp + '" target="_blank" rel="noopener">키 발급 페이지 열기</a>' : "") + "</p>" +
          '<p class="test-result" id="testResult" aria-live="polite"></p>' +
        "</fieldset>" +
        '<fieldset class="field-group">' +
          "<legend>데이터</legend>" +
          '<button type="button" class="btn-ghost danger" data-act="wipe">모든 일정과 할 일 지우기</button>' +
        "</fieldset>" +
        '<div class="settings-actions">' +
          '<button type="button" class="btn-ghost ai-only" data-act="test">연결 확인</button>' +
          '<button type="button" class="btn-ghost" data-act="close">닫기</button>' +
          '<button type="submit" class="btn" data-act="save">저장</button>' +
        "</div>" +
      "</form>"
    );
  }

  function syncVisibility() {
    const provider = dialog.querySelector("[name=provider]").value;
    dialog.querySelectorAll(".ai-only").forEach(el => { el.hidden = provider === "none"; });
  }

  function read() {
    const f = new FormData(dialog.querySelector("#settingsForm"));
    return { provider: f.get("provider"), apiKey: (f.get("apiKey") || "").trim(), model: (f.get("model") || "").trim(), myName: (f.get("myName") || "").trim() };
  }

  function open() {
    dialog.innerHTML = html(store.getSettings());
    syncVisibility();
    dialog.showModal();
  }

  function setResult(text, ok) {
    const el = dialog.querySelector("#testResult");
    el.textContent = text;
    el.className = "test-result " + (ok ? "is-ok" : "is-bad");
  }

  function mount(button) {
    dialog = document.createElement("dialog");
    dialog.className = "settings";
    document.body.appendChild(dialog);
    button.addEventListener("click", open);
    dialog.addEventListener("change", e => {
      if (e.target.name !== "provider") return;
      const s = read();
      s.model = "";
      dialog.innerHTML = html(s);
      syncVisibility();
    });
    dialog.addEventListener("click", async e => {
      const act = e.target.dataset.act;
      if (act === "close") dialog.close();
      if (act === "wipe" && confirm("모든 일정과 할 일을 지울까요? 되돌릴 수 없어요.")) {
        store.clear();
        dialog.close();
      }
      if (act === "test") {
        if (!Tuk.ai) { setResult("AI 연결 기능을 아직 불러오지 못했어요.", false); return; }
        setResult("확인하는 중…", true);
        try {
          await Tuk.ai.ping(read());
          setResult("연결됐어요.", true);
        } catch (err) {
          setResult(err.message, false);
        }
      }
    });
    dialog.addEventListener("submit", e => {
      e.preventDefault();
      store.setSettings(read());
      dialog.close();
    });
  }

  function effective() {
    const s = store.getSettings();
    const p = PROVIDERS[s.provider] || PROVIDERS.none;
    return { provider: s.provider, apiKey: s.apiKey, model: s.model || p.model, myName: s.myName || "", enabled: s.provider !== "none" && Boolean(s.apiKey) };
  }

  return { mount, open, effective, PROVIDERS };
})();
