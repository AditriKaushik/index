process.env.DATABASE_URL = 'postgres://postgres:pgpass@127.0.0.1/omr';
process.env.SESSION_SECRET = 'local-test-secret-long-enough-yes';

const { default: handler } = await import('../netlify/functions/api.mjs');

let pass = 0, fail = 0;
const chk = (l, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  if (ok) { pass++; console.log(`  ok   ${l}`); }
  else { fail++; console.log(`  FAIL ${l} -> got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`); }
};

// --- tiny client that remembers the session cookie, like a browser
function client() {
  let cookie = null;
  return async (path, { method = 'GET', body = null, csrf = true } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (csrf) headers['x-omr-request'] = '1';
    if (cookie) headers.cookie = cookie;
    const res = await handler(new Request('https://x.test/api' + path, {
      method, headers, body: body === null ? undefined : JSON.stringify(body),
    }));
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
}

// Touch the app first: this is what creates the tables on a blank database.
const boot = await handler(new Request('https://x.test/api/health'));
const bootData = await boot.json();
if (!bootData.checks?.find((c) => c.id === 'schema')?.ok) {
  console.error('schema was not created automatically:', JSON.stringify(bootData));
  process.exit(1);
}
console.log('  (tables created automatically on a blank database)\n');

const pgmod = (await import('pg')).default;
const sql = new pgmod.Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();
for (const t of ['section_results','results','responses','test_candidates','answer_keys','sections','candidates','tests']) {
  await sql.query(`DELETE FROM ${t}`);
}
// keep only the seeded admin, so the suite can be run over and over
await sql.query("DELETE FROM branches WHERE username <> 'admin'");
await sql.query('UPDATE branches SET password_hash = $1 WHERE username = $2',
  [(await import('../netlify/functions/lib/auth.mjs')).hashPassword('admin@123'), 'admin']);

console.log('=========== AUTH ===========');
const admin = client();
let r = await admin('/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
chk('wrong staff password refused', r.data.error, 'Incorrect username or password.');

r = await admin('/login', { method: 'POST', body: { username: 'admin', password: 'admin@123' }, csrf: false });
chk('missing CSRF header refused', r.status, 403);

r = await admin('/login', { method: 'POST', body: { username: 'admin', password: 'admin@123' } });
chk('staff login ok', [r.data.ok, r.data.redirect], [true, '/admin']);

r = await admin('/me');
chk('session carries role', r.data.role, 'admin');

const anon = client();
r = await anon('/admin/overview');
chk('anonymous blocked from admin', r.status, 401);

console.log('\n=========== BUILD A TEST ===========');
r = await admin('/admin/test', { method: 'POST', body: {
  id: 0, code: 'NET1', name: 'Netlify Mock', total_questions: 10,
  option_count: 4, marks_correct: 1, marks_wrong: -0.25 } });
chk('test created', r.data.ok, true);
const tid = r.data.id;

r = await admin('/admin/test', { method: 'POST', body: {
  id: 0, code: 'NET1', name: 'Dup', total_questions: 10, option_count: 4,
  marks_correct: 1, marks_wrong: -0.25 } });
chk('duplicate code refused', r.data.error, 'That test code is already in use. Please pick another.');

r = await admin('/admin/status', { method: 'POST', body: { test_id: tid, status: 'open' } });
chk('open with no candidates refused', r.data.error, 'Allot at least one candidate before opening the test.');

r = await admin('/admin/status', { method: 'POST', body: { test_id: tid, status: 'published' } });
chk('publish with no key refused', r.data.error, 'Upload the answer key before publishing the result.');

r = await admin('/admin/key', { method: 'POST', body: {
  test_id: tid, text: '1 A\n2 B\n3 C\n4 D\n5 A,C\n6 *\n7 -\n8 B\n9 C\n10 D' } });
chk('key saved', r.data.message.startsWith('10 of 10 answers saved.'), true);

r = await admin('/admin/sections', { method: 'POST', body: { test_id: tid, sections: [
  { name: 'Reasoning', q_from: 1, q_to: 6 },
  { name: 'Quant', q_from: 5, q_to: 10 } ] } });
chk('overlapping sections refused', r.data.error, '"Reasoning" and "Quant" overlap.');

r = await admin('/admin/sections', { method: 'POST', body: { test_id: tid, sections: [
  { name: 'Reasoning', q_from: 1, q_to: 5 },
  { name: 'Quant', q_from: 6, q_to: 10, marks_correct: '2', marks_wrong: '-0.5' } ] } });
chk('valid sections saved', r.data.message, '2 section(s) saved.');

r = await admin('/admin/candidates', { method: 'POST', body: { test_id: tid, text:
  'roll_no,name,mobile\nN001,Asha Verma,9811100001\nN002,"Iyer, Ramesh",+91 98111 00002\nN003,Bad Row,123' } });
chk('import warns on the bad row', r.data.level, 'warn');
chk('two imported and allotted', [r.data.added, r.data.allotted], [2, 2]);

r = await admin('/admin/status', { method: 'POST', body: { test_id: tid, status: 'open' } });
chk('now opens', r.data.message, 'Test opened for filling.');

console.log('\n=========== CANDIDATE ===========');
const c1 = client();
r = await c1('/login', { method: 'POST', body: { kind: 'candidate', roll_no: 'N001', mobile: '9999999999' } });
chk('wrong mobile refused', r.data.error, 'Roll number and mobile number do not match our records.');
r = await c1('/login', { method: 'POST', body: { kind: 'candidate', roll_no: 'NOPE', mobile: '9811100001' } });
chk('unknown roll gives same message', r.data.error, 'Roll number and mobile number do not match our records.');

r = await c1('/login', { method: 'POST', body: { kind: 'candidate', roll_no: 'N001', mobile: '9811100001' } });
chk('candidate login ok', r.data.redirect, '/omr');

r = await c1('/sheet');
chk('sheet has 10 questions', r.data.test.total, 10);
chk('4 options', r.data.test.letters, ['A','B','C','D']);
chk('2 sections', r.data.sections.length, 2);
chk('quant marks overridden', [r.data.sections[1].marks_correct, r.data.sections[1].marks_wrong], ['2','-0.50']);
chk('starts empty', Object.keys(r.data.answers).length, 0);

r = await c1('/save', { method: 'POST', body: { answers: { 1:'A', 2:'B', 3:'D' } } });
chk('3 saved', [r.data.saved, r.data.filled], [3, 3]);

r = await c1('/save', { method: 'POST', body: { answers: { 4:'Z', 99:'A', 5:'A' } } });
chk('invalid option and out-of-range skipped', [r.data.saved, r.data.skipped], [1, 2]);

r = await c1('/save', { method: 'POST', body: { answers: { 5:'' } } });
chk('clearing works', r.data.filled, 3);

r = await c1('/sheet');
chk('answers come back', r.data.answers, { 1:'A', 2:'B', 3:'D' });

r = await c1('/result');
chk('result redirects back while filling', r.data.state, 'filling');

r = await c1('/submit', { method: 'POST' });
chk('submitted', r.data.redirect, '/result');

r = await c1('/save', { method: 'POST', body: { answers: { 4:'D' } } });
chk('save after submit refused', r.status, 409);

r = await c1('/result');
chk('score hidden before publishing', r.data.state, 'submitted');

// second and third candidates
const c2 = client();
await c2('/login', { method: 'POST', body: { kind: 'candidate', roll_no: 'N002', mobile: '9811100002' } });
await c2('/save', { method: 'POST', body: { answers: { 1:'A',2:'B',3:'C',4:'D',5:'C',6:'A',7:'A',8:'B',9:'C',10:'D' } } });
await c2('/submit', { method: 'POST' });

console.log('\n=========== PUBLISH & RANK ===========');
r = await admin('/admin/status', { method: 'POST', body: { test_id: tid, status: 'published' } });
chk('publish evaluates and ranks', /Evaluated 2 sheet\(s\) and ranked 2 candidate\(s\)/.test(r.data.message), true);

r = await admin('/admin/results?test_id=' + tid);
const merit = r.data.results;
chk('2 in merit list', merit.length, 2);
chk('N002 is rank 1', [merit[0].roll_no, merit[0].rank], ['N002', 1]);
chk('N001 is rank 2', [merit[1].roll_no, merit[1].rank], ['N001', 2]);
// N002: q1-4 right(+1 each in Reasoning 1-5), q5 'C' vs key 'A,C' -> correct(+1),
// q6 bonus(+2), q7 dropped(0), q8,9,10 right(+2 each) = 4+1+2+6 = 13
chk('N002 score = 13', merit[0].score, '13');
chk('N002 percentile', merit[0].percentile, '50');
chk('N001 percentile', merit[1].percentile, '0');

r = await c1('/result');
chk('candidate now sees published result', r.data.state, 'published');
chk('rank shown', r.data.score.rank, 2);
chk('review has 10 rows', r.data.review.length, 10);
chk('q1 correct', r.data.review[0].outcome, 'correct');
chk('q3 wrong', r.data.review[2].outcome, 'wrong');
chk('q6 bonus counts correct', r.data.review[5].outcome, 'correct');
chk('q7 dropped', r.data.review[6].outcome, 'dropped');
chk('sectional rows present', r.data.sections.length, 2);

console.log('\n=========== CSV EXPORT ===========');
r = await admin('/admin/export?test_id=' + tid);
const csvLines = r.data.split('\n');
chk('csv header has section columns', csvLines[0].includes('Quant - Score'), true);
chk('csv has 2 data rows', csvLines.length - 1, 2);
chk('mobile kept as text', csvLines[1].includes("'9811100002"), true);

console.log('\n=========== GUARD RAILS ===========');
r = await admin('/admin/delete-test', { method: 'POST', body: { test_id: tid, confirm_code: 'WRONG' } });
chk('wrong confirm code refused', r.data.error.startsWith('Type the test code exactly'), true);

r = await admin('/admin/staff', { method: 'POST', body: {
  username: 'lucknow', name: 'Lucknow Centre', password: 'branch@123', role: 'branch' } });
chk('branch login created', r.data.message, 'Login created for Lucknow Centre.');

const branch = client();
await branch('/login', { method: 'POST', body: { username: 'lucknow', password: 'branch@123' } });
r = await branch('/admin/delete-test', { method: 'POST', body: { test_id: tid, confirm_code: 'NET1' } });
chk('branch cannot delete', r.status, 403);
chk('test survives', Number((await sql.query('SELECT COUNT(*) FROM tests WHERE id=$1', [tid])).rows[0].count), 1);

r = await admin('/admin/password', { method: 'POST', body: {
  current_password: 'nope', new_password: 'abcdefgh', confirm_password: 'abcdefgh' } });
chk('wrong current password refused', r.data.error, 'Your current password is not correct.');

r = await admin('/logout');
chk('logout clears cookie', r.headers.get('set-cookie').includes('Max-Age=0'), true);

console.log(`\n${pass} passed, ${fail} failed`);
await sql.end();
process.exit(fail === 0 ? 0 : 1);
