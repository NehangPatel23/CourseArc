/**
 * Refresh docs/banks/index.json + README after generating packs.
 * Usage: node scripts/refreshBanksDocsIndex.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BANK_CATALOG } from "./bankConcepts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../docs/banks");

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function fileName(entry) {
  return `${pad(entry.num)}-${entry.slug}.json`;
}

const index = [];
for (const entry of BANK_CATALOG) {
  const name = fileName(entry);
  const full = path.join(OUT, name);
  if (!fs.existsSync(full)) {
    console.warn("Missing", name);
    continue;
  }
  const payload = JSON.parse(fs.readFileSync(full, "utf8"));
  index.push({
    num: entry.num,
    slug: entry.slug,
    title: entry.title,
    file: name,
    questions: payload.questions?.length ?? 0,
  });
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

Every question includes \`feedback\` (and \`correctFeedback\` / \`incorrectFeedback\` where applicable).

All 46 banks are full topic packs (≥90 questions).

## Catalog

| # | File | Title | ~Questions |
|---|------|-------|------------|
${index.map((r) => `| ${r.num} | \`${r.file}\` | ${r.title} | ${r.questions} |`).join("\n")}

## Regenerate

\`\`\`bash
node scripts/generateCsBanks.mjs
\`\`\`
`,
);

console.log(`Indexed ${index.length} banks → ${OUT}`);
