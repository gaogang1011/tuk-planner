const fs = require("fs");
const path = require("path");
const vm = require("vm");

const mem = {};
const ctx = {
  console, Date, Math, JSON, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } }
};
ctx.window = ctx;
vm.createContext(ctx);
["format.js", "store.js", "parser.js", "holidays.js", "calendar.js"].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx, { filename: f });
});
const { fmt, store, cal, parser, holidays } = ctx.Tuk;

let pass = 0;
let total = 0;

function check(name, actual, expected) {
  total++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (ok) pass++;
  console.log((ok ? "통과" : "실패") + "  " + name);
  if (!ok) console.log("      결과: " + a + "\n      기대: " + e);
}

function days(from, to, items) {
  return cal.occurrences(new Date(from), new Date(to), items).map(o => fmt.dayKey(o.start) + " " + fmt.time(o.start));
}

check("주 시작은 월요일 (금요일 기준)", fmt.dayKey(cal.weekStart(new Date("2026-10-09T13:00"))), "2026-10-05");
check("주 시작은 월요일 (일요일 기준)", fmt.dayKey(cal.weekStart(new Date("2026-10-11T23:00"))), "2026-10-05");
check("10월 달력 첫 칸", fmt.dayKey(cal.monthGridStart(new Date("2026-10-15"))), "2026-09-28");
check("2월 달력 첫 칸", fmt.dayKey(cal.monthGridStart(new Date("2027-02-10"))), "2027-02-01");

const weekly = { id: "w", type: "event", title: "팀 회의", start: "2026-10-12T10:00", end: "2026-10-12T11:00", repeat: { freq: "weekly", interval: 1 } };
check("매주 반복 — 10월 회차", days("2026-10-01", "2026-11-01", [weekly]), ["2026-10-12 10:00", "2026-10-19 10:00", "2026-10-26 10:00"]);

const until = Object.assign({}, weekly, { repeat: { freq: "weekly", interval: 1, until: "2026-10-20" } });
check("매주 반복 — 끝나는 날 적용", days("2026-10-01", "2026-11-01", [until]), ["2026-10-12 10:00", "2026-10-19 10:00"]);

const biweekly = Object.assign({}, weekly, { repeat: { freq: "weekly", interval: 2 } });
check("격주 반복", days("2026-10-01", "2026-11-10", [biweekly]), ["2026-10-12 10:00", "2026-10-26 10:00", "2026-11-09 10:00"]);

const mwf = { id: "m", type: "event", title: "운동", start: "2026-10-09T19:00", repeat: { freq: "weekly", interval: 1, days: [1, 3, 5] } };
check("매주 월·수·금", days("2026-10-09", "2026-10-17", [mwf]), ["2026-10-09 19:00", "2026-10-12 19:00", "2026-10-14 19:00", "2026-10-16 19:00"]);

const weekdays = { id: "s", type: "event", title: "스탠드업", start: "2026-10-12T09:00", repeat: { freq: "weekdays", interval: 1 } };
check("평일마다 — 한 주에 5번", days("2026-10-12", "2026-10-19", [weekdays]).length, 5);

const daily = { id: "d", type: "event", title: "산책", start: "2026-10-30T07:00", repeat: { freq: "daily", interval: 1, until: "2026-11-02" } };
check("매일 — 달을 넘어 끝나는 날까지", days("2026-10-01", "2026-12-01", [daily]), ["2026-10-30 07:00", "2026-10-31 07:00", "2026-11-01 07:00", "2026-11-02 07:00"]);

check("할 일은 마감 날짜에 표시", days("2026-10-12", "2026-10-13", [{ id: "t", type: "task", title: "보고서", due: "2026-10-12T18:00" }]), ["2026-10-12 18:00"]);

store.clear();
store.add({ type: "event", title: "교수님 면담", start: "2026-10-13T15:00", end: "2026-10-13T15:30" });
store.add({ type: "event", title: "스탠드업", start: "2026-10-12T09:00", repeat: { freq: "weekdays" } });
const titles = list => list.map(o => o.item.title + " " + fmt.dayKey(o.start));
check("겹침 — 같은 시간 일정", titles(cal.conflicts({ type: "event", title: "새 미팅", start: "2026-10-13T15:15" })), ["교수님 면담 2026-10-13"]);
check("겹침 — 끝나는 시각에 시작하면 안 겹침", titles(cal.conflicts({ type: "event", title: "새 미팅", start: "2026-10-13T15:30" })), []);
check("겹침 — 반복 일정 회차와 겹침", titles(cal.conflicts({ type: "event", title: "아침 회의", start: "2026-10-14T09:30" })), ["스탠드업 2026-10-14"]);
check("겹침 — 주말은 평일 반복과 안 겹침", titles(cal.conflicts({ type: "event", title: "주말 약속", start: "2026-10-17T09:00" })), []);
check("겹침 — 새 반복 일정이 기존 일정과 겹침", cal.conflicts({ type: "event", title: "화요 싱크", start: "2026-10-13T15:00", repeat: { freq: "weekly" } }, 5).length, 1);
store.clear();

const NOW = new Date("2026-10-09T10:20");
const rp = text => JSON.parse(JSON.stringify(parser.parse(text, NOW)));
check("파서 — 매주 월요일", rp("매주 월요일 10시 팀 회의"), [{ type: "event", title: "팀 회의", repeat: { freq: "weekly", interval: 1 }, start: "2026-10-12T10:00" }]);
check("파서 — 격주", rp("격주 목요일 오후 3시 교수님 미팅")[0].repeat, { freq: "weekly", interval: 2 });
check("파서 — 평일마다", rp("평일 아침 9시 스탠드업")[0].repeat, { freq: "weekdays", interval: 1 });
check("파서 — 여러 요일과 끝나는 날", rp("매주 화목 2시-4시 운영체제 수업 12월 15일까지"), [{ type: "event", title: "운영체제 수업", repeat: { freq: "weekly", interval: 1, days: [2, 4], until: "2026-12-15" }, start: "2026-10-13T14:00", end: "2026-10-13T16:00" }]);

check("공휴일 — 한글날", holidays.get("2026-10-09"), "한글날");
check("공휴일 — 대체공휴일", holidays.get("2026-10-05"), "대체공휴일");
check("공휴일 — 평일", holidays.get("2026-10-13"), null);

console.log("\n캘린더: " + pass + "/" + total + " 통과");
process.exit(pass === total ? 0 : 1);
