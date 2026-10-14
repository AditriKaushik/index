// Builds exam/data/catalog.json - the light index the app loads first
// (everything except the question banks). Run after changing any exam file:
//   node exam/data/build-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'exams');
const exams = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
  const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const qs = e.questions || [];
  const topicKeys = new Set((e.trendAnalysis?.topics || []).map(t => `${t.section}|${t.topic}`));
  const relevant = qs.filter(q => topicKeys.has(`${q.section}|${q.topic}`)).length;
  return {
    id: e.id, name: e.name, fullName: e.fullName, nameHi: e.nameHi, category: e.category,
    conductingBody: e.conductingBody, officialSite: e.officialSite, level: e.level,
    frequency: e.frequency, approxCandidates: e.approxCandidates, eligibility: e.eligibility,
    notification: e.notification,
    stage: e.pattern?.stage, durationMinutes: e.pattern?.durationMinutes, totalQuestions: e.pattern?.totalQuestions,
    questionCount: qs.length,
    hasHindi: qs.some(q => q.questionHi),
    aiCount: qs.filter(q => q.source === 'ai').length,
    archetypeCount: (e.pyqBlueprint?.archetypes || []).length,
    quality: {
      pyqRelevance: qs.length ? Math.round(qs.reduce((s, q) => s + (q.relevance?.score || 0), 0) / qs.length) : 0,
      verified: qs.length ? Math.round(100 * qs.filter(q => q.verified).length / qs.length) : 0,
      relevance: qs.length ? Math.round(100 * relevant / qs.length) : 0,
    },
  };
});
fs.writeFileSync(path.join(here, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), exams }, null, 1));
console.log(`catalog.json: ${exams.length} exams, ${exams.reduce((s, e) => s + e.questionCount, 0)} questions`);
