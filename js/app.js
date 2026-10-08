(function () {
  const clock = document.getElementById("clock");

  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleString("ko-KR", {
      month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  tick();
  setInterval(tick, 30000);
})();
