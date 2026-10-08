(function () {
  const { store, views } = Tuk;
  const clock = document.getElementById("clock");
  const upcoming = document.getElementById("upcoming");
  const capture = document.getElementById("capture");
  const nowEl = document.getElementById("now");

  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleString("ko-KR", {
      month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function render() {
    Tuk.now.render(nowEl);
    views.renderList(upcoming);
  }

  Tuk.settings.mount(document.getElementById("openSettings"));
  Tuk.capture.mount(capture);
  views.bindList(upcoming, render);
  store.subscribe(render);
  render();
  tick();
  setInterval(() => { tick(); Tuk.now.render(nowEl); }, 30000);
})();
