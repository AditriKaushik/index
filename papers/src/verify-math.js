const secs=[require('./sec-english.js'),require('./sec-numerical.js'),require('./sec-reasoning.js')];
require('./rebalance.js').rebalance(secs);   // verify the options as actually shipped
const num=secs[1];
const key={}; num.items.filter(i=>i.n).forEach(q=>key[q.n]=parseFloat(String(q.o[q.ans]).replace(/[^0-9.]/g,'')));
// Independently recompute each numeric answer.
const calc={
 31: 24*15/6+38,            32: 0.45*640+0.25*320,      33: 18**2-13**2+45,
 34: 1728/12/4+26,          35: Math.sqrt(1024)+Math.sqrt(576)-Math.sqrt(196),
 36: (3/8)*512+(2/5)*450,   37: 156+24*8-96,            38: 0.65*480-0.30*250,
 39: (36*25)/15+42,         40: (7/12)*864-(5/9)*351,   41: 18*12+15*14,
 42: 25**2-0.15*900,        43: 2450/25+18*6,           44: 0.40*750+(3/7)*294,
 45: Math.sqrt(784)+14**2-60,
 46: 112*2, 47: 65*2-1, 48: 108*3, 49: 74*2+5, 50: 48-13,
 51: 240+180+320+150+210,   52: 300/320*100,            53: (195-150)/150*100,
 // 54 ratio, 55 label -> checked separately
 56: 1440*100/(12000*2),    57: 4*6,                    58: (180/9)*18/5,
 59: (140*0.75)-100,        60: 36/5,                   61: 46*5-42*4,
 62: (36/3+36/6)/2,         63: 10,                     64: 8000*1.1**2-8000,
 65: 20/80*100
};
let bad=0;
for(const n of Object.keys(calc)){
  const got=+calc[n].toFixed(4), want=key[n];
  if(Math.abs(got-want)>1e-6){ console.log(`MISMATCH Q${n}: computed ${got}, key says ${want}`); bad++; }
}
// Q54 ratio and Q63 mixture and Q57 ages verified structurally
const r=[225,252], g=(a,b)=>b?g(b,a%b):a, d=g(r[0],r[1]);
console.log(`Q54 ratio reduces to ${r[0]/d} : ${r[1]/d} (key: ${(q=>q.o[q.ans])(num.items.find(i=>i.n===54))})`);
const milk=60*7/10, water=60*3/10, x=(milk*2-water*3)/3;
console.log(`Q63 water to add = ${x} L (key: ${(q=>q.o[q.ans])(num.items.find(i=>i.n===63))})`);
const A=4*6,B=5*6; console.log(`Q57 check: (${A}+6)/(${B}+6) = ${(A+6)/(B+6)} vs 5/6 = ${5/6}`);
console.log(`Q55 declining branch: R 320->288 = ${288<320}`);
console.log(bad===0 ? 'ALL NUMERIC ANSWERS VERIFIED' : `${bad} MISMATCHES`);
