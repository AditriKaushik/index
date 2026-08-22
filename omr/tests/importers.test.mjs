import { parseAnswerKey, parseCandidateList } from '../netlify/functions/lib/importers.mjs';
let pass=0, fail=0;
const chk=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  if(ok){pass++;console.log(`  ok   ${l}`);}else{fail++;console.log(`  FAIL ${l}\n    got  ${JSON.stringify(g)}\n    want ${JSON.stringify(w)}`);}};
const L=['A','B','C','D'];
const obj=(m)=>Object.fromEntries([...m.entries()]);

console.log('answer key - numbered, mixed separators:');
let r=parseAnswerKey("1 A\n2,B\n3. C\n4: D\n5 - A\n6)B",6,L);
chk('parses all six', obj(r.key), {1:'A',2:'B',3:'C',4:'D',5:'A',6:'B'});
chk('no errors', r.errors, []);

console.log('\nbonus, dropped, multi-correct:');
r=parseAnswerKey("1 A\n2 *\n3 -\n4 A,C",4,L);
chk('special markers', obj(r.key), {1:'A',2:'*',3:'-',4:'A,C'});
chk('no errors', r.errors, []);

console.log('\nsequence mode:');
r=parseAnswerKey("ABCD ABCD\nABCD",12,L);
chk('12 from sequence', r.key.size, 12);
chk('q1', r.key.get(1), 'A');
chk('q12', r.key.get(12), 'D');
r=parseAnswerKey("abcd",4,L);
chk('lowercase uppercased', obj(r.key), {1:'A',2:'B',3:'C',4:'D'});

console.log('\nerror cases:');
r=parseAnswerKey("1 A\n2 Z",2,L);
chk('rejects E on 4-option', r.errors.length, 1);
chk('keeps the good one', obj(r.key), {1:'A'});
r=parseAnswerKey("1 A\n99 B",2,L); chk('out-of-range q', r.errors.length, 1);
r=parseAnswerKey("1 A\n1 B",2,L); chk('duplicate flagged', r.errors.length, 1);
chk('last one wins', r.key.get(1), 'B');
r=parseAnswerKey("1 A,*",2,L); chk('rejects * combined', r.errors.length, 1);
r=parseAnswerKey("",5,L); chk('empty errors', r.errors.length, 1);
r=parseAnswerKey("ABCDE",3,L); chk('sequence too long', r.errors.length>0, true);
r=parseAnswerKey("1 E",1,['A','B','C','D','E']); chk('5-option accepts E', obj(r.key), {1:'E'});
r=parseAnswerKey("# key\n\n1 A\n\n2 B\n",2,L);
chk('skips # and blanks', obj(r.key), {1:'A',2:'B'});
chk('no errors', r.errors, []);

console.log('\ncandidate list:');
r=parseCandidateList("roll_no,name,mobile\nMHS001,Asha Verma,9876543210\nMHS002,Ravi Kumar,+91 98765 43211");
chk('two rows', r.rows.length, 2);
chk('name kept', r.rows[0].name, 'Asha Verma');
chk('+91 stripped', r.rows[1].mobile, '9876543211');
chk('no errors', r.errors, []);
r=parseCandidateList("MHS010\tSunil Rao\t9000000001");
chk('tab separated', r.rows[0].roll_no, 'MHS010');
r=parseCandidateList('MHS020,"Rao, Sunil",9000000002');
chk('csv quoting', r.rows[0].name, 'Rao, Sunil');
r=parseCandidateList('MHS021,"He said ""hi""",9000000003');
chk('escaped quotes', r.rows[0].name, 'He said "hi"');
r=parseCandidateList("MHS001,Asha,123"); chk('short mobile', r.errors.length, 1);
r=parseCandidateList("MHS001,Asha"); chk('missing column', r.errors.length, 1);
r=parseCandidateList("MHS001,Asha,9876543210\nMHS001,Other,9876543211");
chk('duplicate roll', r.errors.length, 1);
chk('keeps first', r.rows.length, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
