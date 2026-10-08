window.Tuk = window.Tuk || {};

Tuk.ai = (function () {
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

  function pad(n) { return String(n).padStart(2, "0"); }

  function nowText(now) {
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "T" + pad(now.getHours()) + ":" + pad(now.getMinutes()) + " (" + WEEK[now.getDay()] + "요일)";
  }

  function resolve(settings) {
    const defaults = (Tuk.settings && Tuk.settings.PROVIDERS) || {};
    const p = defaults[settings.provider] || {};
    return { provider: settings.provider, apiKey: (settings.apiKey || "").trim(), model: (settings.model || "").trim() || p.model };
  }

  function friendlyError(status, detail) {
    if (status === 400 && /api key|API_KEY/i.test(detail)) return "API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.";
    if (status === 401 || status === 403) return "API 키가 거부됐어요. 설정에서 키를 다시 확인해 주세요.";
    if (status === 404) return "모델을 찾을 수 없어요. 설정의 모델 이름을 확인해 주세요.";
    if (status === 429) return "AI 사용량 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.";
    if (status >= 500) return "AI 서비스에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.";
    return "AI 요청이 실패했어요 (" + status + ").";
  }

  async function request(url, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    let res;
    try {
      res = await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "AI 응답이 너무 오래 걸려서 멈췄어요." : "AI 서비스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      clearTimeout(timer);
    }
    const body = await res.text();
    if (!res.ok) throw new Error(friendlyError(res.status, body));
    try { return JSON.parse(body); } catch (e) { throw new Error("AI 응답을 읽지 못했어요."); }
  }

  async function complete(settings, system, user, opts) {
    const json = !(opts && opts.text);
    const s = resolve(settings);
    if (!s.apiKey) throw new Error("API 키를 입력해 주세요.");
    if (s.provider === "gemini") {
      const data = await request("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(s.model) + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": s.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: json ? { temperature: 0, responseMimeType: "application/json" } : { temperature: 0.4 }
        })
      });
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      return parts.map(p => p.text || "").join("");
    }
    if (s.provider === "claude") {
      const data = await request("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": s.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model: s.model, max_tokens: 1500, system, messages: [{ role: "user", content: user }] })
      });
      return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    }
    throw new Error("AI 서비스를 선택해 주세요.");
  }

  function extractJson(text) {
    const t = String(text || "").trim();
    try { return JSON.parse(t); } catch (e) {}
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e) {}
    }
    throw new Error("AI 응답 형식이 올바르지 않아요.");
  }

  function clean(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.items) ? raw.items : []);
    return list
      .filter(x => x && typeof x.title === "string" && x.title.trim())
      .map(x => {
        const type = x.type === "event" ? "event" : "task";
        const dt = v => (typeof v === "string" && DT.test(v) ? v : null);
        const out = { type, title: x.title.trim().slice(0, 120) };
        if (type === "event") {
          out.start = dt(x.start);
          if (dt(x.end)) out.end = dt(x.end);
          if (x.allDay === true && out.start) out.allDay = true;
        } else {
          out.due = dt(x.due);
        }
        if (typeof x.owner === "string" && x.owner.trim()) out.owner = x.owner.trim().slice(0, 30);
        if (typeof x.mine === "boolean") out.mine = x.mine;
        return out;
      });
  }

  const ITEM_RULES = [
    "각 항목은 {\"type\": \"event\" | \"task\", \"title\": 문자열, \"start\": 시작, \"end\": 종료, \"due\": 마감, \"allDay\": 불리언} 형태다.",
    "- event: 정해진 시각에 참석하거나 만나는 것 (회의, 미팅, 면담, 수업, 약속, 시험 등). start 필수, end는 알 때만.",
    "- task: 내가 해야 하는 일 (작성, 제출, 정리, 준비, 연락 등). due는 마감이 있을 때만.",
    "- 모든 날짜는 \"YYYY-MM-DDTHH:mm\" 형식의 현지 시각. 모르면 null.",
    "- 시각 없이 날짜만 있는 일정은 start를 그날 00:00으로 하고 allDay를 true로.",
    "- 날짜만 있고 시각이 없는 할 일은 due를 그날 23:59로.",
    "- 오전/오후가 없는 1~7시는 오후로 본다.",
    "- \"그 전에\"는 앞 일정의 시작 시각을 마감으로, \"끝나고\"는 앞 일정이 끝난 날 23:59를 마감으로 한다.",
    "- 날짜 없이 시각만 있으면 지금 이후 가장 가까운 그 시각.",
    "- title은 날짜·시간 표현과 \"하기\", \"해야 함\" 같은 어미를 빼고 짧은 명사구로."
  ].join("\n");

  async function parseLine(settings, text, now) {
    const system = [
      "너는 한국어 일정·할 일 정리 도우미다. 사용자의 한 줄 입력을 일정(event)과 할 일(task)로 나눈다.",
      "현재 시각: " + nowText(now || new Date()),
      ITEM_RULES,
      "출력은 {\"items\": [...]} JSON 하나만. 설명이나 코드 블록 없이."
    ].join("\n");
    const out = await complete(settings, system, text);
    return clean(extractJson(out));
  }

  async function extractMemo(settings, text, now) {
    const me = (settings.myName || "").trim();
    const system = [
      "너는 회의록에서 실행할 일을 뽑는 도우미다. 사용자가 붙여 넣은 회의 메모에서 할 일(task)과 앞으로 잡힌 일정(event)만 뽑는다.",
      "현재 시각: " + nowText(now || new Date()),
      ITEM_RULES,
      "추가 규칙:",
      "- 이미 지난 논의, 결정 사항, 단순 정보는 뽑지 않는다.",
      "- 담당자가 적혀 있으면 owner에 그 이름을, 없으면 owner를 null로.",
      "- mine은 사용자 본인이 해야 하는 항목이면 true. " + (me ? "사용자의 이름은 \"" + me + "\"이다. 담당자가 다른 사람이면 false, 담당자가 없거나 \"다 같이\", \"전원\"이면 true." : "사용자 이름을 모르므로 담당자가 없거나 다 같이 하는 일만 true, 특정 사람이 맡은 일은 false."),
      "- 다음 회의 같은 일정은 mine을 true로.",
      "- title에는 담당자 이름을 넣지 않는다.",
      "출력은 {\"items\": [...]} JSON 하나만. 설명이나 코드 블록 없이."
    ].join("\n");
    const out = await complete(settings, system, text);
    return clean(extractJson(out));
  }

  async function briefing(settings, facts, now) {
    const system = [
      "너는 바쁜 대학생의 하루를 정리해 주는 비서다.",
      "현재 시각: " + nowText(now || new Date()),
      "주어진 JSON(오늘 남은 일정, 빈 시간, 할 일)을 보고 한국어 존댓말로 2~3문장 브리핑을 쓴다.",
      "남은 일정 수와 마감을 먼저 말하고, 가장 쓸 만한 빈 시간에 무엇을 하면 좋을지 구체적으로 추천한다.",
      "목록, 마크다운, 이모지 없이 평문만 쓴다. 주어진 정보에 없는 일정은 만들지 않는다."
    ].join("\n");
    const out = await complete(settings, system, JSON.stringify(facts), { text: true });
    return out.replace(/[*#`]/g, "").trim().slice(0, 400);
  }

  async function ping(settings) {
    const out = await complete(settings, "JSON으로만 답한다.", "{\"ok\": true}를 그대로 출력해.");
    extractJson(out);
    return true;
  }

  return { complete, parseLine, extractMemo, briefing, ping, clean, extractJson, nowText, ITEM_RULES };
})();
