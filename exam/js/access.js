// Who may start a test today. The rules live in PLAN so they are easy to
// change without touching any other code.
//
// IMPORTANT: this runs in the browser, so on its own it is an honour system.
// Once payments are switched on, passes must be issued and checked by a
// server (see exam/README.md, "Payments").

export const PLAN = {
  freeDays: 1,              // first day: unlimited tests, no sign-up, no payment
  dailyFreeTests: 1,        // afterwards: this many free tests every day, forever
  passes: [
    { id: 'day',   days: 1,  price: 9,   label: '1-day pass',   labelHi: '1 दिन का पास' },
    { id: 'week',  days: 7,  price: 39,  label: '7-day pass',   labelHi: '7 दिन का पास' },
    { id: 'month', days: 30, price: 99,  label: '30-day pass',  labelHi: '30 दिन का पास' },
  ],
  // "Money should not be a blocker": anyone can ask for a free pass, no questions asked.
  supportPassDays: 7,
};

const DAY = 24 * 60 * 60 * 1000;
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// state: { firstSeen, passUntil, testsByDay: {day: n}, supportUsedAt }
export function accessStatus(state, now = Date.now()) {
  const first = state.firstSeen ?? now;
  const trialEnds = new Date(first);
  trialEnds.setHours(0, 0, 0, 0);
  const trialUntil = trialEnds.getTime() + PLAN.freeDays * DAY;
  const usedToday = state.testsByDay?.[dayKey(now)] || 0;

  if (now < trialUntil) return { allowed: true, reason: 'trial', until: trialUntil, usedToday };
  if (state.passUntil && now < state.passUntil) return { allowed: true, reason: 'pass', until: state.passUntil, usedToday };
  const left = Math.max(0, PLAN.dailyFreeTests - usedToday);
  return { allowed: left > 0, reason: left > 0 ? 'daily-free' : 'limit', freeLeft: left, usedToday };
}

export function recordTestStart(state, now = Date.now()) {
  const k = dayKey(now);
  return { ...state, firstSeen: state.firstSeen ?? now, testsByDay: { ...(state.testsByDay || {}), [k]: ((state.testsByDay || {})[k] || 0) + 1 } };
}

export function grantPass(state, days, now = Date.now()) {
  const from = Math.max(now, state.passUntil || 0);
  return { ...state, passUntil: from + days * DAY };
}

// One support pass per 30 days per device.
export function canRequestSupport(state, now = Date.now()) {
  return !state.supportUsedAt || now - state.supportUsedAt > 30 * DAY;
}
export function grantSupportPass(state, now = Date.now()) {
  return { ...grantPass(state, PLAN.supportPassDays, now), supportUsedAt: now };
}
