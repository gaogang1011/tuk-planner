window.Tuk = window.Tuk || {};

Tuk.parser = (function () {
  const DAYS = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };

  const EVENT_WORDS = /(회의|미팅|면담|약속|수업|세미나|발표|상담|만남|모임|스터디|면접|OT|오티|진료|강의|워크숍|행사|식사|밥|통화|인터뷰|시험|회식|출장|데이트|레슨|진료|병원|미용실)/i;
  const TASK_WORDS = /(하기|해야|제출|마감|정리|작성|준비|보내|답장|확인|검토|수정|읽기|공부|과제|업로드|신청|구매|사기|챙기|연락|예약하|찾아보|만들기|복습|예습|끝내)/;
  const BEFORE_WORDS = /^\s*(그\s*전에|그전에|전에|미리|사전에)\s*/;
  const AFTER_WORDS = /^\s*(끝나고|끝난\s*(후에?|뒤에?)|그\s*다음에?|이후에?|그\s*후에?|다녀와서)\s*/;

  const TIME = /(오전|오후|아침|저녁|밤|새벽|점심|낮)?\s*(\d{1,2})(?:\s*:\s*(\d{2})|\s*시(?!간)(?:\s*(반)|\s*(\d{1,2})\s*분)?)/g;

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function mondayOf(d) {
    const x = startOfDay(d);
    const dow = (x.getDay() + 6) % 7;
    return addDays(x, -dow);
  }

  function cut(state, match) {
    state.text = state.text.slice(0, match.index) + " " + state.text.slice(match.index + match[0].length);
  }

  function findDate(state, now) {
    const today = startOfDay(now);
    const rules = [
      [/(다다음\s*주|다음\s*주|담주|이번\s*주|금주|이번주)\s*([월화수목금토일])(?:요일)?/, m => {
        const off = /다다음/.test(m[1]) ? 2 : /다음|담주/.test(m[1]) ? 1 : 0;
        return addDays(mondayOf(today), off * 7 + (DAYS[m[2]] + 6) % 7);
      }],
      [/(\d{1,2})\s*월\s*(\d{1,2})\s*일/, m => {
        let d = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
        if (d < addDays(today, -30)) d = new Date(today.getFullYear() + 1, +m[1] - 1, +m[2]);
        return d;
      }],
      [/(?<![\d:])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d:])/, m => {
        let d = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
        if (d < addDays(today, -30)) d = new Date(today.getFullYear() + 1, +m[1] - 1, +m[2]);
        return d;
      }],
      [/(\d{1,2})\s*일\s*(?:후|뒤)(?:에)?/, m => addDays(today, +m[1])],
      [/(\d{1,2})\s*주\s*(?:후|뒤)(?:에)?/, m => addDays(today, +m[1] * 7)],
      [/(다다음\s*주|다음\s*주|담주)(?:에)?/, m => addDays(mondayOf(today), /다다음/.test(m[1]) ? 14 : 7)],
      [/(이번\s*)?주말(?:에)?/, () => {
        const sat = addDays(mondayOf(today), 5);
        return sat < today ? today : sat;
      }],
      [/오늘|금일/, () => today],
      [/내일|낼/, () => addDays(today, 1)],
      [/모레/, () => addDays(today, 2)],
      [/글피/, () => addDays(today, 3)],
      [/([월화수목금토일])요일/, m => {
        const diff = (DAYS[m[1]] - today.getDay() + 7) % 7;
        return addDays(today, diff);
      }],
      [/(?<!\d)(\d{1,2})\s*일(?!\s*(?:후|뒤|간|정|부터))/, m => {
        let d = new Date(today.getFullYear(), today.getMonth(), +m[1]);
        if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, +m[1]);
        return d;
      }]
    ];
    for (const [re, fn] of rules) {
      const m = state.text.match(re);
      if (m) {
        cut(state, m);
        return fn(m);
      }
    }
    return null;
  }

  function toHour(mer, h) {
    if (!mer) {
      if (h >= 1 && h <= 7) return h + 12;
      return h;
    }
    if (/오후|저녁|밤/.test(mer)) return h < 12 ? h + 12 : h;
    if (/점심|낮/.test(mer)) return h < 6 ? h + 12 : h;
    return h === 12 ? 0 : h;
  }

  function findTimes(state) {
    state.text = state.text.replace(/정오/g, "낮 12시");
    let durationMin = null;
    const dur = state.text.match(/(\d{1,2})\s*시간(?:\s*(반))?(?:\s*동안)?|(\d{1,3})\s*분\s*동안/);
    if (dur) {
      durationMin = dur[3] ? +dur[3] : +dur[1] * 60 + (dur[2] ? 30 : 0);
      cut(state, dur);
    }
    const found = [];
    TIME.lastIndex = 0;
    let m;
    while ((m = TIME.exec(state.text))) {
      const h = +m[2];
      if (h > 24) continue;
      const min = m[3] ? +m[3] : m[4] ? 30 : m[5] ? +m[5] : 0;
      found.push({ index: m.index, length: m[0].length, mer: m[1] || null, h, min, colon: Boolean(m[3]) });
    }
    if (!found.length) return { start: null, end: null, durationMin };
    const a = found[0];
    const startH = a.colon && a.h >= 13 ? a.h : toHour(a.mer, a.h);
    const start = { h: startH % 24, m: a.min };
    let end = null;
    let consumedEnd = a.index + a.length;
    if (found[1]) {
      const between = state.text.slice(a.index + a.length, found[1].index);
      if (/^\s*(부터|~|-|–|에서)\s*$/.test(between)) {
        const b = found[1];
        let eh = b.colon && b.h >= 13 ? b.h : b.mer ? toHour(b.mer, b.h) : b.h;
        if (!b.mer && !b.colon && eh <= startH) eh += 12;
        if (!b.mer && !b.colon && eh < startH) eh = startH + 1;
        end = { h: eh % 24, m: b.min };
        consumedEnd = b.index + b.length;
        const tail = state.text.slice(consumedEnd).match(/^\s*까지/);
        if (tail) consumedEnd += tail[0].length;
      }
    }
    state.text = state.text.slice(0, a.index) + " " + state.text.slice(consumedEnd);
    return { start, end, durationMin };
  }

  function cleanTitle(s) {
    return s
      .replace(BEFORE_WORDS, " ")
      .replace(AFTER_WORDS, " ")
      .replace(/(^|\s)(에|에는|에서|까지|부터|쯤|경|정도|동안)(?=\s|$)/g, " ")
      .replace(/(까지|쯤|경에?)(?=\s|$)/g, "")
      .replace(/\s*(해야\s*(함|해|됨|돼|한다|할\s*듯)?|하기|할\s*것|하자|하자고)\s*[.!]*$/, "")
      .replace(/^\s*(에|은|는|이|가|을|를)\s+/, "")
      .replace(/[.!]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function local(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function splitClauses(text) {
    return text
      .split(/[,\n;，]|그리고|(?<=[가-힣])\s+(?=(?:그\s*전에|그전에|끝나고|끝난\s*후))/)
      .map(s => (s || "").trim())
      .filter(Boolean);
  }

  function parseClause(raw, now, prev) {
    const relBefore = BEFORE_WORDS.test(raw);
    const relAfter = AFTER_WORDS.test(raw);
    const state = { text: " " + raw + " " };
    let date = findDate(state, now);
    const times = findTimes(state);
    const hasDue = /까지/.test(state.text);
    const isTaskWord = TASK_WORDS.test(state.text);
    const isEventWord = EVENT_WORDS.test(raw);
    let type;
    if (hasDue || relBefore || relAfter) type = "task";
    else if (isTaskWord) type = "task";
    else if (isEventWord) type = "event";
    else type = times.start ? "event" : "task";

    let inherited = false;
    if (!date && prev && prev.date) {
      date = prev.date;
      inherited = true;
    }

    const title = cleanTitle(state.text) || raw.trim();
    const out = { type, title };

    if (type === "event") {
      if (times.start) {
        let d = date ? new Date(date) : startOfDay(now);
        d.setHours(times.start.h, times.start.m, 0, 0);
        if (!date && d < now) d = addDays(d, 1);
        out.start = local(d);
        if (times.end) {
          const e = new Date(d);
          e.setHours(times.end.h, times.end.m, 0, 0);
          if (e <= d) e.setDate(e.getDate() + 1);
          out.end = local(e);
        } else if (times.durationMin) {
          out.end = local(new Date(d.getTime() + times.durationMin * 60000));
        }
      } else if (date) {
        out.start = local(date);
        out.allDay = true;
      }
    } else {
      if (relBefore && prev && prev.item && prev.item.type === "event" && prev.item.start && !times.start && (!date || inherited)) {
        out.due = prev.item.start;
      } else if (date || times.start) {
        let d = date ? new Date(date) : startOfDay(now);
        if (times.start) d.setHours(times.start.h, times.start.m, 0, 0);
        else d.setHours(23, 59, 0, 0);
        if (!date && d < now) d = addDays(d, 1);
        out.due = local(d);
      }
    }
    return { item: out, date: date ? startOfDay(date) : null };
  }

  function parse(text, now) {
    const base = now || new Date();
    const clauses = splitClauses(String(text || ""));
    const items = [];
    let prev = null;
    clauses.forEach(c => {
      const r = parseClause(c, base, prev);
      if (r.item.title) items.push(r.item);
      prev = { item: r.item, date: r.date };
    });
    return items;
  }

  return { parse };
})();
