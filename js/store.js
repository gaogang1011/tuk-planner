window.Tuk = window.Tuk || {};

Tuk.store = (function () {
  const KEY = "tuk.items.v1";
  const SETTINGS_KEY = "tuk.settings.v1";
  const listeners = [];
  let items = load();

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function load() {
    const raw = safeGet(KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    safeSet(KEY, JSON.stringify(items));
    listeners.forEach(fn => fn(items));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalize(input) {
    const type = input.type === "event" ? "event" : "task";
    return {
      id: input.id || uid(),
      type,
      title: String(input.title || "").trim() || (type === "event" ? "새 일정" : "새 할 일"),
      start: type === "event" ? (input.start || null) : null,
      end: type === "event" ? (input.end || null) : null,
      allDay: type === "event" && Boolean(input.allDay),
      due: type === "task" ? (input.due || null) : null,
      done: Boolean(input.done),
      source: input.source || "manual",
      createdAt: input.createdAt || new Date().toISOString()
    };
  }

  function all() {
    return items.slice();
  }

  function add(input) {
    const item = normalize(input);
    items.push(item);
    save();
    return item;
  }

  function addMany(list) {
    const added = list.map(normalize);
    items = items.concat(added);
    save();
    return added;
  }

  function update(id, patch) {
    items = items.map(it => (it.id === id ? normalize(Object.assign({}, it, patch, { id })) : it));
    save();
  }

  function remove(id) {
    items = items.filter(it => it.id !== id);
    save();
  }

  function toggle(id) {
    const it = items.find(x => x.id === id);
    if (it) update(id, { done: !it.done });
  }

  function clear() {
    items = [];
    save();
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function getSettings() {
    const raw = safeGet(SETTINGS_KEY);
    const base = { provider: "none", apiKey: "", model: "", myName: "" };
    if (!raw) return base;
    try { return Object.assign(base, JSON.parse(raw)); } catch (e) { return base; }
  }

  function setSettings(patch) {
    const next = Object.assign(getSettings(), patch);
    safeSet(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  return { all, add, addMany, update, remove, toggle, clear, subscribe, getSettings, setSettings };
})();
