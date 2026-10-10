# Exam data file schema (`exam/data/exams/<id>.json`)

One JSON file per exam. All text in English unless a `*Hi` (Hindi) field is given.
Questions must be ORIGINAL, written in the style/difficulty/topic mix of the last
3 years' papers. Never copy a previous-year question verbatim (copyright); model it.

```jsonc
{
  "id": "ssc-cgl",                      // kebab-case, equals file name
  "name": "SSC CGL",
  "fullName": "Staff Selection Commission – Combined Graduate Level",
  "nameHi": "एसएससी सीजीएल",
  "category": "ssc",                    // one of: engineering, medical, university, ssc, banking, railway, upsc, defence, teaching, management, law, state, school, postgraduate
  "conductingBody": "Staff Selection Commission",
  "officialSite": "https://ssc.gov.in",
  "level": "national",                  // national | state
  "frequency": "Once a year",
  "approxCandidates": "≈30 lakh applicants (2025)",
  "eligibility": "Graduate, 18–32 yrs (post-wise)",
  "notification": {
    "status": "released",               // released | expected | ongoing | closed | result-out
    "summary": "One or two sentences on the latest cycle as of the check date.",
    "importantDates": [ { "event": "Tier 1 exam", "date": "Sep 2026 (tentative)" } ],
    "source": "https://… (official page you saw)",
    "checkedOn": "2026-10-10"
  },
  "pattern": {
    "stage": "Tier 1",                  // which stage the mock test simulates
    "mode": "CBT",
    "durationMinutes": 60,
    "totalQuestions": 100,
    "totalMarks": 200,
    "marking": { "correct": 2, "wrong": -0.5, "unattempted": 0 },
    "sections": [ { "id": "reasoning", "name": "General Intelligence & Reasoning", "questions": 25, "marks": 50 } ],  // optional per section: "wrong": 0 to override negative marking
    "notes": "Anything special (sectional timing, normalisation, …)"
  },
  "trendAnalysis": {
    "yearsAnalyzed": [2024, 2025, 2026],
    "summary": "3–6 sentences: what changed, difficulty level, high-yield areas.",
    "topics": [
      // weightage = average share (%) of that section's questions; per section they should sum to ~100
      { "section": "reasoning", "topic": "Coding-Decoding", "weightage": 8, "trend": "stable", "difficulty": "easy" }
    ]
  },
  "resources": {
    "pyqAvailable": true,
    "officialPYQ": "https://… or null",
    "officialMock": "https://… or null",
    "notes": "Where previous papers / answer keys are officially published."
  },
  "questions": [
    {
      "id": "ssc-cgl-001",
      "section": "reasoning",           // must match a pattern.sections[].id
      "topic": "Coding-Decoding",       // must match a trendAnalysis.topics[].topic in the same section
      "difficulty": "easy",             // easy | medium | hard
      "question": "Text. Use plain text; for maths use unicode (x², √, π, ≤) not LaTeX.",
      "options": ["A", "B", "C", "D"],  // exactly 4 unless the exam really uses another count
      "answer": 2,                      // 0-based index of the correct option
      "explanation": "Short worked solution showing why the answer is right.",
      "verified": true                  // you re-solved it independently and got the same answer
    }
  ]
}
```

Quality bar (proof-reading checklist, applied to every question):
1. Exactly one option is correct; re-solve independently before marking `verified`.
2. Topic is in the exam's official syllabus and in `trendAnalysis.topics` (relevance).
3. Difficulty and style match recent papers for that exam.
4. No spelling/grammar errors, no ambiguity, facts current as of 2026.
5. Explanation is correct and self-contained.
Drop any question that fails — fewer good questions beat more weak ones.
