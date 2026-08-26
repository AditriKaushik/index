// Deterministically permute option order so correct answers spread evenly across (a)-(e).
// Questions whose option ORDER carries meaning are left untouched.
const LOCK_LAST = /^(None|No error|More than three|None of these)$/i;
const COUNT_WORD = /^(None|One|Two|Three|Four|Five|Six|Seven|Eight|More than three|More than four)$/i;
const SYL_FIRST = /^Only conclusion I follows$/;

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function isFixed(q){
  if (q.noOpts) return true;                       // error-detection: (a)-(d) map to sentence parts
  if (SYL_FIRST.test(q.o[0])) return true;         // syllogism / inequality standard option order
  if (q.o.every(o => COUNT_WORD.test(String(o)))) return true;  // ascending count options: order is meaningful
  return false;
}

function rebalance(sections, seed=20260826){
  const rnd = mulberry32(seed);
  const qs = sections.flatMap(s => s.items.filter(i => i.n));
  const counts = [0,0,0,0,0];
  qs.forEach(q => counts[q.ans]++);

  const movable = qs.filter(q => !isFixed(q));
  // slots a question may place its answer in (respecting a locked trailing option)
  const slotsFor = q => (LOCK_LAST.test(String(q.o[q.o.length-1])) ? [0,1,2,3] : [0,1,2,3,4]);

  const target = Math.round(qs.length / 5);        // 20 each
  // process in seeded order for stability
  const order = movable.map((q,i)=>({q,k:rnd()})).sort((x,y)=>x.k-y.k).map(x=>x.q);

  for (const q of order){
    const legal = slotsFor(q);
    // choose the legal slot that is furthest below target
    let best = null, bestDef = -Infinity;
    for (const s of legal){
      const def = target - counts[s] - (s === q.ans ? 0 : 0);
      if (def > bestDef){ bestDef = def; best = s; }
    }
    if (best === null || best === q.ans) continue;
    if (LOCK_LAST.test(String(q.o[q.o.length-1])) && q.ans === q.o.length-1) continue; // don't drag a locked option out of last slot
    if (counts[q.ans] - 1 < target - 1 && counts[best] >= target) continue;
    // swap the correct option into slot `best`
    const tmp = q.o[best]; q.o[best] = q.o[q.ans]; q.o[q.ans] = tmp;
    if (q.oh){ const th = q.oh[best]; q.oh[best] = q.oh[q.ans]; q.oh[q.ans] = th; }
    counts[q.ans]--; counts[best]++;
    q.ans = best;
  }
  return { counts, movable: movable.length, fixed: qs.length - movable.length };
}
module.exports = { rebalance };
