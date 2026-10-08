window.Tuk = window.Tuk || {};

Tuk.shortcuts = (function () {
  let dialog;
  const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  const LIST = [
    ["찾기·추가·명령", [mod, "K"]],
    ["입력창으로 가기", ["N"]],
    ["일 / 주 / 월 보기", ["D", "W", "M"]],
    ["오늘로", ["T"]],
    ["이전 / 다음", ["←", "→"]],
    ["사이드바 접기", ["["]],
    ["오늘 패널 접기", ["]"]],
    ["화면에 띄우기 (위젯)", ["P"]],
    ["상세·창 닫기", ["Esc"]],
    ["이 안내", ["?"]]
  ];

  function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "settings shortcuts";
      dialog.innerHTML =
        '<div class="settings-form">' +
          '<h2 class="settings-title">단축키</h2>' +
          '<dl class="sc-list">' + LIST.map(([label, keys]) => "<dt>" + label + "</dt><dd>" + keys.map(k => "<kbd>" + k + "</kbd>").join(" ") + "</dd>").join("") + "</dl>" +
          '<p class="hint">입력창에 글을 쓰는 중에는 한 글자 단축키가 동작하지 않아요.</p>' +
          '<div class="settings-actions"><button type="button" class="btn" data-close>닫기</button></div>' +
        "</div>";
      document.body.appendChild(dialog);
      dialog.addEventListener("click", e => { if (e.target === dialog || e.target.closest("[data-close]")) dialog.close(); });
    }
    if (!dialog.open) dialog.showModal();
  }

  return { open };
})();
