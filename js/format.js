window.Tuk = window.Tuk || {};

Tuk.fmt = (function () {
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function pad(n) { return String(n).padStart(2, "0"); }

  function toLocal(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function parse(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function dayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function dayDiff(d, base) {
    return Math.round((startOfDay(d) - startOfDay(base || new Date())) / 86400000);
  }

  function dayLabel(d, base) {
    const diff = dayDiff(d, base);
    const md = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEK[d.getDay()] + ")";
    if (diff === 0) return "오늘 · " + md;
    if (diff === 1) return "내일 · " + md;
    if (diff === 2) return "모레 · " + md;
    if (diff === -1) return "어제 · " + md;
    return md;
  }

  function time(d) {
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function shortDate(d, base) {
    const diff = dayDiff(d, base);
    if (diff === 0) return "오늘 " + time(d);
    if (diff === 1) return "내일 " + time(d);
    if (diff === 2) return "모레 " + time(d);
    return (d.getMonth() + 1) + "/" + d.getDate() + "(" + WEEK[d.getDay()] + ") " + time(d);
  }

  function duration(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h && m) return h + "시간 " + m + "분";
    if (h) return h + "시간";
    return m + "분";
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return { WEEK, pad, toLocal, parse, startOfDay, dayKey, dayDiff, dayLabel, time, shortDate, duration, escape };
})();
