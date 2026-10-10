// Everything the app remembers lives in one localStorage entry on this device.
const KEY = 'mockpariksha.v1';
const empty = () => ({ access: {}, attempts: [], inProgress: null, prefs: { lang: 'en' } });

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s ? { ...empty(), ...s } : empty();
  } catch { return empty(); }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // storage full or blocked: drop the oldest attempts' per-question detail and retry once
    try {
      state.attempts.slice(0, -20).forEach(a => { delete a.responses; });
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch { return false; }
  }
}
