// Brute-force both puzzles to confirm the clue sets admit exactly one arrangement.
function perms(arr){ if(arr.length<=1) return [arr]; const out=[];
  arr.forEach((v,i)=>{ const rest=[...arr.slice(0,i),...arr.slice(i+1)];
    perms(rest).forEach(p=>out.push([v,...p])); }); return out; }

// ---- Puzzle 1: linear row, 8 friends, positions 1..8 left->right facing north ----
let sols1=[];
for(const p of perms(['A','B','C','D','E','F','G','H'])){
  const pos={}; p.forEach((x,i)=>pos[x]=i+1);
  if(pos.C+3 !== pos.F) continue;                       // C third to left of F
  if(Math.abs(pos.F-pos.H) !== 4) continue;             // three persons between F and H
  if(pos.H+2 !== pos.A) continue;                       // A second to right of H
  const ends=[pos.B,pos.G].sort((a,b)=>a-b);
  if(!(ends[0]===1 && ends[1]===8)) continue;           // B and G at extreme ends
  if(pos.B-3 !== pos.D) continue;                       // D third to left of B
  sols1.push(p.join(''));
}
console.log('Puzzle 1 (row) solutions:', sols1.length, sols1);

// ---- Puzzle 2: 7 floors, floor 1 lowest ----
let sols2=[];
for(const p of perms(['P','Q','R','S','T','U','V'])){
  const f={}; p.forEach((x,i)=>f[x]=i+1);              // p[0] on floor 1
  if(Math.abs(f.P-f.Q) !== 4) continue;                // three persons between P and Q
  if(!(f.Q>f.P && f.Q%2===0)) continue;                // Q even-numbered, above P
  if(f.R !== f.S+1) continue;                          // R immediately above S
  if(f.T !== 1) continue;                              // T on floor 1
  if(f.U !== 7) continue;                              // U topmost
  if(Math.abs(f.S-f.P) !== 2) continue;                // only one person between S and P
  sols2.push(p.join(''));
}
console.log('Puzzle 2 (floors) solutions:', sols2.length, sols2);

// ---- Coding-decoding: confirm the derivable words are forced ----
const S=[[['bank','gives','easy','loan'],['ta','ri','no','se']],
         [['easy','loan','for','all'],['no','se','ka','da']],
         [['bank','has','easy','branch'],['ri','mo','se','pu']],
         [['all','loan','approved','now'],['ka','no','zi','lo']]];
const words=[...new Set(S.flatMap(s=>s[0]))], codes=[...new Set(S.flatMap(s=>s[1]))];
const maps=[]; 
(function assign(i,m,used){
  if(i===words.length){
    for(const [ws,cs] of S){ const got=ws.map(w=>m[w]).sort().join(',');
      if(got!==[...cs].sort().join(',')) return; }
    maps.push({...m}); return; }
  for(const c of codes){ if(used.has(c)) continue;
    m[words[i]]=c; used.add(c); assign(i+1,m,used); used.delete(c); }
})(0,{},new Set());
const forced={};
for(const w of words){ const vals=new Set(maps.map(m=>m[w])); forced[w]=vals.size===1?[...vals][0]:'AMBIGUOUS'; }
console.log('Coding: consistent mappings =', maps.length);
console.log('Coding forced values:', JSON.stringify(forced));
