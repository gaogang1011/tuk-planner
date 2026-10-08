const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, Date, Math, JSON };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "parser.js"), "utf8"), ctx);
const { parse, extractMemo } = ctx.Tuk.parser;

const NOW = new Date("2026-10-09T10:20");

const cases = [
  ["다음 주 화요일 3시 교수님 면담, 그 전에 자료 정리", [
    { type: "event", title: "교수님 면담", start: "2026-10-13T15:00" },
    { type: "task", title: "자료 정리", due: "2026-10-13T15:00" }
  ]],
  ["내일 오후 2시 팀 회의", [{ type: "event", title: "팀 회의", start: "2026-10-10T14:00" }]],
  ["금요일까지 운영체제 과제 제출", [{ type: "task", title: "운영체제 과제 제출", due: "2026-10-09T23:59" }]],
  ["10월 15일 오전 10시부터 12시까지 세미나", [{ type: "event", title: "세미나", start: "2026-10-15T10:00", end: "2026-10-15T12:00" }]],
  ["모레 저녁 7시 동아리 회식", [{ type: "event", title: "동아리 회식", start: "2026-10-11T19:00" }]],
  ["메일 답장하기", [{ type: "task", title: "메일 답장" }]],
  ["오늘 4시 반 휴플 미팅 1시간", [{ type: "event", title: "휴플 미팅", start: "2026-10-09T16:30", end: "2026-10-09T17:30" }]],
  ["다음주 월요일 데이터베이스 시험", [{ type: "event", title: "데이터베이스 시험", start: "2026-10-12T00:00", allDay: true }]],
  ["내일 3시 회의 끝나고 회의록 정리", [
    { type: "event", title: "회의", start: "2026-10-10T15:00" },
    { type: "task", title: "회의록 정리", due: "2026-10-10T23:59" }
  ]],
  ["10/20 14:30 면접", [{ type: "event", title: "면접", start: "2026-10-20T14:30" }]],
  ["이번 주말에 발표 연습하기", [{ type: "task", title: "발표 연습", due: "2026-10-10T23:59" }]],
  ["수요일 점심 1시 약속 그리고 그 전에 선물 사기", [
    { type: "event", title: "약속", start: "2026-10-14T13:00" },
    { type: "task", title: "선물 사기", due: "2026-10-14T13:00" }
  ]],
  ["담주 목욜 오후 세시 스터디", [{ type: "event", title: "스터디", start: "2026-10-15T15:00" }]],
  ["저녁 여섯시 반 알바", [{ type: "event", title: "알바", start: "2026-10-09T18:30" }]],
  ["12월 3일 기말고사", [{ type: "event", title: "기말고사", start: "2026-12-03T00:00", allDay: true }]]
];

function same(actual, expected) {
  if (actual.length !== expected.length) return false;
  return expected.every((e, i) => Object.keys(e).every(k => actual[i][k] === e[k]));
}

let pass = 0;
cases.forEach(([text, expected]) => {
  const got = JSON.parse(JSON.stringify(parse(text, NOW)));
  const ok = same(got, expected);
  if (ok) pass++;
  console.log((ok ? "통과" : "실패") + "  " + text);
  if (!ok) console.log("      결과: " + JSON.stringify(got) + "\n      기대: " + JSON.stringify(expected));
});

const memo = [
  "회의 메모 10/9",
  "- 지난주 결과 공유함",
  "- 다음 회의는 수요일 2시",
  "- 강혁: 화면 시안 금요일까지 공유",
  "- 준혁: API 문서 정리",
  "- 발표 자료는 다 같이 월요일 오전까지"
].join("\n");
const memoGot = JSON.parse(JSON.stringify(extractMemo(memo, NOW, "강혁")));
const memoOk = same(memoGot, [
  { type: "event", title: "다음 회의", start: "2026-10-14T14:00", mine: true },
  { type: "task", title: "화면 시안 공유", owner: "강혁", mine: true },
  { type: "task", title: "API 문서 정리", owner: "준혁", mine: false },
  { type: "task", title: "발표 자료", due: "2026-10-12T23:59", mine: true }
]);
console.log((memoOk ? "통과" : "실패") + "  회의 메모 추출");
if (!memoOk) console.log("      결과: " + JSON.stringify(memoGot));

console.log("\n한 줄 입력: " + pass + "/" + cases.length + " 통과, 회의 메모: " + (memoOk ? "통과" : "실패"));
process.exit(pass === cases.length && memoOk ? 0 : 1);
