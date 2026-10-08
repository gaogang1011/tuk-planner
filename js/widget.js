window.Tuk = window.Tuk || {};

Tuk.widget = (function () {
  const { fmt } = Tuk;
  const SIZE = { width: 320, height: 480 };
  let pip = null;
  let root = null;

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

  function render() {
    if (!root) return;
    const now = new Date();
    const st = Tuk.now.status(now);
    const next = st.current || st.next;
    root.innerHTML =
      '<header class="wg-head"><span class="brand">툭</span><span class="wg-clock">' + fmt.time(now) + "</span></header>" +
      '<section class="wg-next">' +
        (next
          ? '<p class="wg-kicker">' + (st.current ? "진행 중" : "다음 일정까지") + '</p><p class="wg-big">' + fmt.duration((st.current ? next.end : next.start) - now) + '</p><p class="wg-sub">' + fmt.escape(fmt.shortDate(next.start) + " · " + next.item.title) + "</p>"
          : '<p class="wg-kicker">다음 일정</p><p class="wg-big is-quiet">없어요</p>') +
      "</section>";
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
      pip = await window.documentPictureInPicture.requestWindow(SIZE);
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

  return { mount, open, close, render, supported, isOpen: () => Boolean(pip) };
})();
