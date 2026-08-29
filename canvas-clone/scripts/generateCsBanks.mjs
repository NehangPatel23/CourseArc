/**
 * Generate all 46 CS question-bank JSON packs (importable via Question Banks → Import).
 * Usage: node scripts/generateCsBanks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BANK_CATALOG, TOPIC_CONCEPTS, getLang } from "./bankConcepts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../docs/banks");
const PACK = path.join(__dirname, "../src/data/bankPacks");

function pad(n, w = 3) {
  return String(n).padStart(w, "0");
}

function fb(answer, why, mistake, takeaway) {
  const correct = [
    `Answer: ${answer}`,
    ``,
    `Why:`,
    why,
    mistake ? `\nCommon mistake:\n${mistake}` : "",
    takeaway ? `\nTakeaway:\n${takeaway}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n")
    .replace(/\n\n\n+/g, "\n\n");
  const incorrect = [
    `Answer: ${answer}`,
    mistake ? `\nCommon mistake:\n${mistake}` : "",
    ``,
    `Why:`,
    why,
    takeaway ? `\nTakeaway:\n${takeaway}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n")
    .replace(/\n\n\n+/g, "\n\n");
  return { feedback: correct, correctFeedback: correct, incorrectFeedback: incorrect };
}

function withFb(q, answer, why, mistake, takeaway) {
  return { ...q, ...fb(answer, why, mistake || "", takeaway || "") };
}

function normConcept(c) {
  return {
    ...c,
    wrong1: c.wrong1 || c.w1 || "An unrelated algorithm",
    wrong2: c.wrong2 || c.w2 || "A hardware-only concern",
    wrong3: c.wrong3 || c.w3 || "A deprecated practice with no modern use",
    term: c.term || String(c.answer).split(/[,/]/)[0].trim(),
  };
}

function buildTopicBank(entry) {
  const concepts = (TOPIC_CONCEPTS[entry.slug] || []).map(normConcept);
  if (concepts.length < 40) {
    throw new Error(`Need ≥40 concepts for ${entry.slug}, got ${concepts.length}`);
  }
  const lang = entry.lang || getLang(entry.slug);
  const qs = [];
  let n = 1;
  const id = () => `${entry.slug}_q${pad(n++)}`;

  qs.push({
    id: id(),
    type: "note",
    prompt: `## ${entry.title}\nBank for quizzes from introductory through advanced ${entry.title}.`,
    points: 0,
    feedback: "Instructional note — not graded.",
  });
  qs.push({
    id: id(),
    type: "note",
    prompt: `### Coverage\nIncludes multiple-choice, multi-select, true/false, short answer, fill-in, numerical, matching, essay, inline code, coding, ordering, multi-blank fill-in, calculated, Likert, and hotspot items.`,
    points: 0,
    feedback: "Instructional note — not graded.",
  });

  /** Minimal SVG pipeline diagram for hotspot items (percent-based regions). */
  const hotspotDiagramUrl =
    "data:image/svg+xml," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
<rect width="400" height="200" fill="#f3f4f6"/>
<rect x="20" y="30" width="100" height="60" fill="#dbeafe" stroke="#2563eb"/>
<text x="70" y="65" text-anchor="middle" font-size="14" fill="#1e3a8a">Input</text>
<rect x="150" y="30" width="100" height="60" fill="#dcfce7" stroke="#16a34a"/>
<text x="200" y="65" text-anchor="middle" font-size="14" fill="#14532d">Process</text>
<rect x="280" y="30" width="100" height="60" fill="#fef9c3" stroke="#ca8a04"/>
<text x="330" y="65" text-anchor="middle" font-size="14" fill="#713f12">Output</text>
<rect x="20" y="120" width="360" height="50" fill="#fee2e2" stroke="#dc2626"/>
<text x="200" y="150" text-anchor="middle" font-size="14" fill="#7f1d1d">Storage</text>
</svg>`);

  const hotspotRegions = [
    { id: "input", label: "Input", x: 5, y: 15, w: 25, h: 30 },
    { id: "process", label: "Process", x: 37.5, y: 15, w: 25, h: 30 },
    { id: "output", label: "Output", x: 70, y: 15, w: 25, h: 30 },
    { id: "storage", label: "Storage", x: 5, y: 60, w: 90, h: 25 },
  ];

  // 35 MC
  for (let i = 0; i < 35; i++) {
    const c = concepts[i % concepts.length];
    const choices = [c.answer, c.wrong1, c.wrong2, c.wrong3];
    const correct = i % 4;
    const rotated = [...choices];
    const ans = rotated.shift();
    rotated.splice(correct, 0, ans);
    qs.push(
      withFb(
        {
          id: id(),
          type: "multiple_choice",
          prompt: c.q,
          points: 1,
          choices: rotated,
          correctChoiceIndex: correct,
        },
        c.answer,
        c.why,
        c.mistake,
        c.takeaway || `Remember: ${c.answer}.`,
      ),
    );
  }

  // 8 multi-answer
  for (let i = 0; i < 8; i++) {
    const batch = [0, 1, 2, 3].map((j) => concepts[(i * 3 + j) % concepts.length]);
    const choices = [
      batch[0].answer,
      batch[1].answer,
      batch[2].answer,
      "Unrelated buzzword with no bearing on this topic",
      batch[3].answer,
      "Deprecated practice that does not apply here",
    ];
    qs.push(
      withFb(
        {
          id: id(),
          type: "multiple_answers",
          prompt: `Select all statements/terms that correctly belong to ${entry.title} (set ${i + 1}).`,
          points: 2,
          choices,
          correctChoiceIndices: [0, 1, 2, 4],
        },
        [0, 1, 2, 4].map((k) => choices[k]).join("; "),
        `These options are valid ${entry.title} concepts drawn from the course catalog.`,
        "Selecting plausible but off-topic distractors.",
        "Multi-select rewards precise category membership.",
      ),
    );
  }

  // 12 T/F
  for (let i = 0; i < 12; i++) {
    const c = concepts[i % concepts.length];
    const truth = i % 3 !== 0;
    qs.push(
      withFb(
        {
          id: id(),
          type: "true_false",
          prompt: truth
            ? `True or false: ${c.answer} is a central idea when studying ${c.topic || entry.title}.`
            : `True or false: ${c.wrong1} is the standard definition used for ${c.term} in ${entry.title}.`,
          points: 1,
          correctTrueFalse: truth,
        },
        truth ? "True" : "False",
        truth ? c.why : `False. The correct idea is “${c.answer}”. ${c.why}`,
        c.mistake || "Accepting absolute claims without checking definitions.",
        c.takeaway || "Verify definitions against reliable notes.",
      ),
    );
  }

  // 8 short answer
  for (let i = 0; i < 8; i++) {
    const c = concepts[i % concepts.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "short_answer",
          prompt: `Name the ${entry.title} concept: ${c.q.replace(/\?$/, "")}.`,
          points: 1,
          correctShortAnswer: c.term,
          acceptedAnswers: [c.term, c.term.toLowerCase(), c.answer],
        },
        c.term,
        c.why,
        c.mistake || "Using a verbose phrase instead of the standard term.",
        c.takeaway || c.term,
      ),
    );
  }

  // 6 FIB
  for (let i = 0; i < 6; i++) {
    const c = concepts[i % concepts.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "fill_in_blank",
          prompt: `Fill in the blank (${entry.title}): A standard term for this idea — ${c.q.replace(/\?$/, "")} — is ____.`,
          points: 1,
          acceptedAnswers: [c.term, c.term.toLowerCase()],
        },
        c.term,
        c.why,
        c.mistake || "Spelling variants may be accepted when listed in the key.",
        c.takeaway || c.term,
      ),
    );
  }

  // 5 numerical
  const nums = [
    { q: "⌈log₂(32)⌉ = ?", a: 5, why: "2^5 = 32." },
    { q: "Bytes in 4 KiB?", a: 4096, why: "4 × 1024 = 4096." },
    { q: "2^10 = ?", a: 1024, why: "Binary kilo." },
    { q: "Bits in 2 bytes?", a: 16, why: "8 bits per byte." },
    { q: "3! = ?", a: 6, why: "3×2×1=6." },
  ];
  for (let i = 0; i < 5; i++) {
    const v = nums[i];
    qs.push(
      withFb(
        {
          id: id(),
          type: "numerical",
          prompt: `[${entry.title} quantitative] ${v.q}`,
          points: 1,
          correctNumber: v.a,
          tolerance: 0,
        },
        String(v.a),
        v.why,
        "Off-by-one or mixing SI vs binary prefixes.",
        v.why,
      ),
    );
  }

  // 5 matching
  for (let i = 0; i < 5; i++) {
    const slice = [0, 1, 2, 3].map((j) => concepts[(i * 4 + j) % concepts.length]);
    const matchingPairs = slice.map((c, j) => ({
      id: `${entry.slug}_mp${i}_${j}`,
      left: c.term.slice(0, 48),
      right: c.answer.slice(0, 80),
    }));
    qs.push(
      withFb(
        {
          id: id(),
          type: "matching",
          prompt: `Match each ${entry.title} term to the best description (set ${i + 1}).`,
          points: 3,
          matchingPairs,
        },
        matchingPairs.map((p) => `${p.left} → ${p.right}`).join("; "),
        "Each term maps to its standard definition in this topic.",
        "Swapping closely related definitions.",
        "Matching checks precise term–definition binding.",
      ),
    );
  }

  // 4 essays
  for (let i = 0; i < 4; i++) {
    const c = concepts[i % concepts.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "essay",
          prompt: `Explain “${c.answer}” in the context of ${entry.title}. Contrast with one common misconception. (1–2 paragraphs)`,
          points: 5,
        },
        c.answer,
        c.why,
        c.mistake || "Listing buzzwords without mechanisms or trade-offs.",
        c.takeaway || "Prefer mechanisms and trade-offs over slogans.",
      ),
    );
  }

  // 4 inline + 3 coding (language-aware)
  const inlinePack = {
    python: [
      ["Return max(a,b).", "def larger(a, b):\n    ", ["return max(a, b)", "return a if a >= b else b"]],
      ["Return True if n even.", "def is_even(n):\n    ", ["return n % 2 == 0"]],
      ["Return len(xs).", "def length(xs):\n    ", ["return len(xs)"]],
      ["Return xs[::-1].", "def rev(xs):\n    ", ["return xs[::-1]"]],
    ],
    java: [
      ["Return Math.max(a,b).", "int max2(int a, int b) {\n  ", ["return Math.max(a, b);", "return a >= b ? a : b;"]],
      ["Return n%2==0.", "boolean isEven(int n) {\n  ", ["return n % 2 == 0;"]],
      ["Return s.length().", "int len(String s) {\n  ", ["return s.length();"]],
      ["Return Math.abs(n).", "int abs(int n) {\n  ", ["return Math.abs(n);"]],
    ],
    javascript: [
      ["Return Math.max(a,b).", "function max2(a, b) {\n  ", ["return Math.max(a, b);"]],
      ["Return n%2===0.", "function isEven(n) {\n  ", ["return n % 2 === 0;"]],
      ["Return xs.length.", "function len(xs) {\n  ", ["return xs.length;"]],
      ["Return [...xs].", "function copy(xs) {\n  ", ["return [...xs];", "return xs.slice();"]],
    ],
    c: [
      ["Return max.", "int max2(int a, int b) {\n  ", ["return a >= b ? a : b;"]],
      ["Return even.", "int is_even(int n) {\n  ", ["return n % 2 == 0;"]],
      ["Return abs.", "int iabs(int n) {\n  ", ["return n < 0 ? -n : n;"]],
      ["Return a+b.", "int add(int a, int b) {\n  ", ["return a + b;"]],
    ],
    cpp: [
      ["Return std::max.", "int max2(int a, int b) {\n  ", ["return std::max(a, b);", "return a >= b ? a : b;"]],
      ["Return even.", "bool is_even(int n) {\n  ", ["return n % 2 == 0;"]],
      ["Return v.size().", "size_t len(const std::vector<int>& v) {\n  ", ["return v.size();"]],
      ["Return abs.", "int iabs(int n) {\n  ", ["return std::abs(n);", "return n < 0 ? -n : n;"]],
    ],
    html: [
      ["Empty paragraph.", "", ["<p></p>"]],
      ["Link Home to https://example.com", "", ['<a href="https://example.com">Home</a>']],
      ["img cat.png alt Cat", "", ['<img src="cat.png" alt="Cat">', '<img src="cat.png" alt="Cat" />']],
      ["Open ul", "", ["<ul>"]],
    ],
    css: [
      ["body color red", "body {\n  ", ["color: red;", "color:red;"]],
      ["display none", ".x {\n  ", ["display: none;"]],
      ["font-weight bold", ".b {\n  ", ["font-weight: bold;"]],
      ["text-align center", ".c {\n  ", ["text-align: center;"]],
    ],
    sql: [
      ["Select all from users", "", ["SELECT * FROM users;", "select * from users;"]],
      ["Count users", "", ["SELECT COUNT(*) FROM users;"]],
      ["Delete from logs", "", ["DELETE FROM logs;"]],
      ["Select name order by name", "", ["SELECT name FROM users ORDER BY name;"]],
    ],
  };
  const pack = inlinePack[lang] || inlinePack.python;
  for (let i = 0; i < 4; i++) {
    const [prompt, starter, answers] = pack[i % pack.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "inline_code",
          prompt: `[${entry.title}] ${prompt}`,
          points: 2,
          language: lang,
          acceptedAnswers: answers,
          starterCode: starter,
          codeMaxLines: 12,
        },
        answers[0],
        "Accepted snippets implement the requested behavior.",
        "Forgetting return, wrong operator, or off-by-one.",
        "Keep helpers tiny and testable.",
      ),
    );
  }

  const codingPack = {
    python: [
      [
        "factorial(n) for n>=0",
        "def factorial(n):\n    pass\n",
        "def factorial(n):\n    if n < 2:\n        return 1\n    return n * factorial(n - 1)\n",
      ],
      [
        "is_palindrome ignoring spaces",
        "def is_palindrome(s):\n    pass\n",
        "def is_palindrome(s):\n    t = s.replace(' ', '')\n    return t == t[::-1]\n",
      ],
      ["sum_list(xs)", "def sum_list(xs):\n    pass\n", "def sum_list(xs):\n    return sum(xs)\n"],
    ],
    java: [
      [
        "factorial",
        "int factorial(int n) {\n  return 0;\n}\n",
        "int factorial(int n) {\n  if (n < 2) return 1;\n  return n * factorial(n - 1);\n}\n",
      ],
      [
        "sum array",
        "int sum(int[] xs) {\n  return 0;\n}\n",
        "int sum(int[] xs) {\n  int s = 0;\n  for (int x : xs) s += x;\n  return s;\n}\n",
      ],
      [
        "isEven",
        "boolean isEven(int n) {\n  return false;\n}\n",
        "boolean isEven(int n) {\n  return n % 2 == 0;\n}\n",
      ],
    ],
    javascript: [
      [
        "factorial",
        "function factorial(n) {\n  \n}\n",
        "function factorial(n) {\n  if (n < 2) return 1;\n  return n * factorial(n - 1);\n}\n",
      ],
      [
        "sum",
        "function sum(xs) {\n  \n}\n",
        "function sum(xs) {\n  return xs.reduce((a, b) => a + b, 0);\n}\n",
      ],
      [
        "isPalindrome",
        "function isPalindrome(s) {\n  \n}\n",
        "function isPalindrome(s) {\n  const t = s.replace(/ /g, '');\n  return t === [...t].reverse().join('');\n}\n",
      ],
    ],
    c: [
      [
        "factorial iterative",
        "int factorial(int n) {\n  return 0;\n}\n",
        "int factorial(int n) {\n  int r = 1;\n  for (int i = 2; i <= n; i++) r *= i;\n  return r;\n}\n",
      ],
      [
        "sum array",
        "int sum(int *xs, int n) {\n  return 0;\n}\n",
        "int sum(int *xs, int n) {\n  int s = 0;\n  for (int i = 0; i < n; i++) s += xs[i];\n  return s;\n}\n",
      ],
      ["is_even", "int is_even(int n) {\n  return 0;\n}\n", "int is_even(int n) {\n  return n % 2 == 0;\n}\n"],
    ],
    cpp: [
      [
        "factorial",
        "int factorial(int n) {\n  return 0;\n}\n",
        "int factorial(int n) {\n  if (n < 2) return 1;\n  return n * factorial(n - 1);\n}\n",
      ],
      [
        "sum vector",
        "int sum(const std::vector<int>& xs) {\n  return 0;\n}\n",
        "int sum(const std::vector<int>& xs) {\n  int s = 0;\n  for (int x : xs) s += x;\n  return s;\n}\n",
      ],
      [
        "is_even",
        "bool is_even(int n) {\n  return false;\n}\n",
        "bool is_even(int n) {\n  return n % 2 == 0;\n}\n",
      ],
    ],
  };
  const codeTasks = codingPack[lang] || codingPack.python;
  for (let i = 0; i < 3; i++) {
    const [prompt, starter, correct] = codeTasks[i % codeTasks.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "coding",
          prompt: `[${entry.title}] ${prompt}`,
          points: 5,
          language: lang,
          starterCode: starter,
          correctCode: correct,
          autoGradeCode: true,
        },
        "See reference solution",
        "Reference solution covers expected base/edge cases.",
        "Missing base case or mutating inputs unexpectedly.",
        "Simplest correct solution first, then optimize.",
      ),
    );
  }

  // 3 ordering
  const orderingSets = [
    {
      prompt: `Order these ${entry.title} concepts from foundational to advanced.`,
      pick: (i) => [0, 1, 2, 3].map((j) => concepts[(i + j) % concepts.length]),
      map: (c) => c.term,
    },
    {
      prompt: `Order these ${entry.title} steps in the usual workflow (first → last).`,
      pick: (i) => [1, 2, 3, 4].map((j) => concepts[(i + j) % concepts.length]),
      map: (c) => `Apply ${c.term}`,
    },
    {
      prompt: `Arrange these ${entry.title} ideas from general principle to specific technique.`,
      pick: (i) => [2, 3, 4, 5].map((j) => concepts[(i + j) % concepts.length]),
      map: (c) => `${c.topic}: ${c.term}`,
    },
  ];
  for (let i = 0; i < 3; i++) {
    const set = orderingSets[i];
    const picked = set.pick(i);
    const items = picked.map(set.map);
    qs.push(
      withFb(
        {
          id: id(),
          type: "ordering",
          prompt: set.prompt,
          points: 2,
          orderingItems: items,
          correctOrder: items.map((_, idx) => idx),
        },
        items.join(" → "),
        "Each step builds on the previous one in standard course progression.",
        "Swapping adjacent but related steps without reading definitions.",
        "Ordering checks whether you know prerequisite relationships.",
      ),
    );
  }

  // 2 fill-in-multiple-blanks
  const fimbTemplates = [
    (c) => ({
      prompt: `[${entry.title}] The term {{term}} describes {{idea}} when studying {{topic}}.`,
      fillBlanks: [
        { id: "term", label: "term", acceptedAnswers: [c.term, c.term.toLowerCase()] },
        {
          id: "idea",
          label: "idea",
          acceptedAnswers: [c.answer.slice(0, 48), c.answer.toLowerCase().slice(0, 48)],
        },
        {
          id: "topic",
          label: "topic",
          acceptedAnswers: [c.topic || entry.title, (c.topic || entry.title).toLowerCase()],
        },
      ],
      answer: `${c.term}; ${c.answer}; ${c.topic || entry.title}`,
      why: c.why,
      mistake: "Filling only one blank or using a synonym not listed in the key.",
      takeaway: c.takeaway || c.term,
    }),
    (c) => ({
      prompt: `[${entry.title}] {{term}} contrasts with {{contrast}} because {{reason}}.`,
      fillBlanks: [
        { id: "term", label: "term", acceptedAnswers: [c.term, c.term.toLowerCase()] },
        {
          id: "contrast",
          label: "contrast",
          acceptedAnswers: [c.wrong1.slice(0, 40), c.wrong1.toLowerCase().slice(0, 40)],
        },
        {
          id: "reason",
          label: "reason",
          acceptedAnswers: [c.answer.slice(0, 48), c.answer.toLowerCase().slice(0, 48)],
        },
      ],
      answer: `${c.term}; ${c.wrong1}; ${c.answer}`,
      why: c.why,
      mistake: "Confusing a related distractor with the contrasting concept.",
      takeaway: c.takeaway || c.term,
    }),
  ];
  for (let i = 0; i < fimbTemplates.length; i++) {
    const c = concepts[(i + 5) % concepts.length];
    const tpl = fimbTemplates[i](c);
    qs.push(
      withFb(
        {
          id: id(),
          type: "fill_in_multiple_blanks",
          prompt: tpl.prompt,
          points: 2,
          fillBlanks: tpl.fillBlanks,
        },
        tpl.answer,
        tpl.why,
        tpl.mistake,
        tpl.takeaway,
      ),
    );
  }

  // 2 calculated
  const calcTemplates = [
    {
      prompt: `[${entry.title}] If x = [x] and y = [y], what is x + y?`,
      formula: "x + y",
      vars: [
        { name: "x", min: 3, max: 25, decimals: 0 },
        { name: "y", min: 2, max: 20, decimals: 0 },
      ],
      why: "Substitute the generated values and evaluate the sum.",
    },
    {
      prompt: `[${entry.title}] Given n = [n] and k = [k], compute n × k.`,
      formula: "n * k",
      vars: [
        { name: "n", min: 4, max: 15, decimals: 0 },
        { name: "k", min: 2, max: 12, decimals: 0 },
      ],
      why: "Multiply the two generated integers.",
    },
  ];
  for (const tpl of calcTemplates) {
    qs.push(
      withFb(
        {
          id: id(),
          type: "calculated",
          prompt: tpl.prompt,
          points: 2,
          calculatedFormula: tpl.formula,
          calculatedVariables: tpl.vars,
          calculatedTolerance: 0,
        },
        tpl.formula,
        tpl.why,
        "Using the wrong operator or forgetting to substitute variable values.",
        "Calculated items check arithmetic with per-student variable draws.",
      ),
    );
  }

  // 2 likert (one survey, one graded)
  for (let i = 0; i < 2; i++) {
    const c = concepts[(i + 8) % concepts.length];
    const isSurvey = i === 0;
    qs.push(
      withFb(
        {
          id: id(),
          type: "likert",
          prompt: isSurvey
            ? `[Survey] How confident are you explaining “${c.term}” in ${entry.title}?`
            : `[${entry.title}] Rate agreement: “${c.answer}”`,
          points: isSurvey ? 0 : 1,
          likertMin: 1,
          likertMax: 5,
          likertMinLabel: isSurvey ? "Not confident" : "Strongly disagree",
          likertMaxLabel: isSurvey ? "Very confident" : "Strongly agree",
          ...(isSurvey ? {} : { correctLikertValue: 4 }),
        },
        isSurvey ? "No single correct answer" : "4 — agree",
        isSurvey
          ? "Collects self-reported confidence for instructional review."
          : c.why,
        isSurvey
          ? "Treating survey items as right/wrong."
          : "Picking extremes without reading the statement carefully.",
        isSurvey
          ? "Surveys report distributions, not correctness."
          : c.takeaway || c.answer,
      ),
    );
  }

  // 2 hotspot
  const hotspotPrompts = [
    {
      prompt: `[${entry.title}] Click the **Input** stage in this pipeline diagram.`,
      correct: ["input"],
      why: "Input is where raw data enters before processing.",
    },
    {
      prompt: `[${entry.title}] Click the **Storage** layer in this architecture diagram.`,
      correct: ["storage"],
      why: "Persistent data lives in the storage layer beneath processing.",
    },
  ];
  for (const hp of hotspotPrompts) {
    qs.push(
      withFb(
        {
          id: id(),
          type: "hotspot",
          prompt: hp.prompt,
          points: 2,
          hotspotImageUrl: hotspotDiagramUrl,
          hotspotRegions,
          correctHotspotIds: hp.correct,
        },
        hp.correct.join(", "),
        hp.why,
        "Selecting an adjacent stage with a similar label.",
        "Hotspot items test spatial recognition of architecture roles.",
      ),
    );
  }

  // group pool
  const kids = concepts.slice(0, 6).map((c, j) =>
    withFb(
      {
        id: `${entry.slug}_pool_${j + 1}`,
        type: "multiple_choice",
        prompt: `[Pool] ${c.q}`,
        points: 1,
        choices: [c.answer, c.wrong1, c.wrong2, c.wrong3],
        correctChoiceIndex: 0,
      },
      c.answer,
      c.why,
      c.mistake,
      c.takeaway || c.answer,
    ),
  );
  qs.push({
    id: id(),
    type: "group",
    prompt: `${entry.title} — random check pool`,
    points: 0,
    pickCount: 2,
    groupQuestions: kids,
    feedback: "Draws 2 items from this pool each attempt.",
  });

  while (qs.length < 90) {
    const c = concepts[qs.length % concepts.length];
    qs.push(
      withFb(
        {
          id: id(),
          type: "multiple_choice",
          prompt: `${c.q} [extra ${qs.length}]`,
          points: 1,
          choices: [c.answer, c.wrong1, c.wrong2, c.wrong3],
          correctChoiceIndex: 0,
        },
        c.answer,
        c.why,
        c.mistake,
        c.takeaway || c.answer,
      ),
    );
  }

  return {
    version: 1,
    title: entry.title,
    questions: qs,
    exportedAt: Date.now(),
  };
}

function fileName(entry) {
  return `${pad(entry.num, 2)}-${entry.slug}.json`;
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PACK, { recursive: true });

const index = [];
for (const entry of BANK_CATALOG) {
  const payload = buildTopicBank(entry);
  const name = fileName(entry);
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(path.join(OUT, name), json);
  fs.writeFileSync(path.join(PACK, name), json);
  index.push({
    num: entry.num,
    slug: entry.slug,
    title: entry.title,
    file: name,
    questions: payload.questions.length,
  });
  console.log(`Wrote ${name} (${payload.questions.length} questions)`);
}

fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
fs.writeFileSync(
  path.join(OUT, "README.md"),
  `# CS question bank import pack (46 banks)

Each \`.json\` file matches the Question Banks export format:

\`\`\`json
{ "version": 1, "title": "...", "questions": [ ... ], "exportedAt": ... }
\`\`\`

## How to import

1. Open a course → **Question Banks**
2. Click **Import**
3. Choose one file from this folder (or several, one at a time)
4. Resolve title conflicts with **Rename / Replace / Skip** if prompted

Every question includes \`feedback\`, \`correctFeedback\`, and \`incorrectFeedback\` (notes/groups use a short non-graded note).

Banks 01–05 are the extended originals (Data Structures, Algorithms, Programming Fundamentals, Systems, NLP) at the same full size as 06–46.

## Catalog

| # | File | Title | ~Questions |
|---|------|-------|------------|
${index.map((r) => `| ${r.num} | \`${r.file}\` | ${r.title} | ${r.questions} |`).join("\n")}

Regenerate with:

\`\`\`bash
node scripts/generateCsBanks.mjs
\`\`\`
`,
);

console.log(`\nDone: ${index.length} banks → ${OUT}`);
