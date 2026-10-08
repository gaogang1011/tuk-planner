(function () {
  const { store, views } = Tuk;
  const clock = document.getElementById("clock");
  const upcoming = document.getElementById("upcoming");
  const capture = document.getElementById("capture");

  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleString("ko-KR", {
      month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function render() {
    views.renderList(upcoming);
  }

  Tuk.capture.mount(capture);
  views.bindList(upcoming, render);
  store.subscribe(render);
  render();
  tick();
  setInterval(tick, 30000);
})();
