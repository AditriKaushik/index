// Service worker: the only place that talks to the Claude API (the page's own
// CSP and CORS rules don't apply here). The API key never reaches the page.

const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are a meticulous proofreader for competitive-exam and school test content (MCQ tests, mock tests, quizzes). Content may be in English, Hindi, or both (bilingual papers).

You get numbered text blocks captured from a test web page, in page order. A question, its options, the answer key and the solution may be spread over several consecutive blocks — read them together.

Report every real problem a content editor must fix:
- spelling: misspelt words, wrong matra/nukta in Hindi, typos.
- grammar: grammar or punctuation errors, wrong word usage, awkward or unclear phrasing.
- calculation: any arithmetic, formula or numeric step that is wrong. Re-solve every numeric question yourself. If a correct answer / key / solution is shown, check it; if no option matches the true answer, report that.
- duplicate: repeated questions, two identical options, the same option text twice.
- answer-key: the marked correct answer or the explanation is wrong or contradicts the question.
- factual: an outdated or false fact, wrong date, name or figure.
- question: anything that makes the question invalid or irrelevant — missing data, more than one correct option, no correct option, ambiguous wording, a reference to a figure/table/passage that is not present, options that do not match the question, Hindi and English versions that say different things, out-of-context or incomplete text.

Rules:
- Only report actual problems. Do not report style preferences, and do not report UI text like buttons, timers or menus.
- "quote" must be copied EXACTLY (character for character) from the block, as short as possible but unique within the block, so it can be highlighted.
- "suggestion" is the corrected text that should replace the quote (empty string if not applicable).
- "explanation" is one or two short sentences. Write it in the language of the content (Hindi for Hindi content).
- Severity: high = wrong answer/calculation/invalid question; medium = spelling/grammar a student would notice; low = minor polish.
- If a block has no problems, report nothing for it. An empty list is a valid answer.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['block', 'category', 'severity', 'quote', 'suggestion', 'explanation'],
        properties: {
          block: { type: 'integer', description: 'Block number the problem is in' },
          category: { type: 'string', enum: ['spelling', 'grammar', 'calculation', 'duplicate', 'answer-key', 'factual', 'question'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          quote: { type: 'string' },
          suggestion: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
  },
};

async function aiCheck({ blocks, apiKey, model, effort }) {
  const body = blocks.map((b) => `[${b.id}] ${b.text}`).join('\n\n');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Proofread these blocks from the page:\n\n${body}` }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error('API key is wrong (401). Popup में सही key डालें।');
    if (res.status === 429) throw new Error('Rate limit hit (429) — थोड़ी देर बाद फिर से try करें।');
    throw new Error(`Claude API ${res.status}: ${msg}`);
  }
  if (data.stop_reason === 'refusal') throw new Error('Claude declined to check this part of the page.');
  if (data.stop_reason === 'max_tokens') throw new Error('Response cut off — page part too long; try again.');
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const parsed = JSON.parse(text);
  return parsed.issues || [];
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== 'ai-check') return false;
  chrome.storage.local.get({ apiKey: '', model: 'claude-opus-5-5', effort: 'high' }).then(async (s) => {
    if (!s.apiKey) return reply({ error: 'No API key. Extension popup खोलकर Claude API key डालें।' });
    try {
      reply({ issues: await aiCheck({ blocks: msg.blocks, apiKey: s.apiKey, model: s.model, effort: s.effort }) });
    } catch (e) {
      reply({ error: e.message || String(e) });
    }
  });
  return true; // async reply
});
