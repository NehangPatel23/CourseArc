import type { Quiz, QuizQuestion } from "./quizzes";
import { normalizeQuizQuestions } from "./quizzes";
import { quizExportFilename } from "./quizExport";
import type { QuestionBank } from "./questionBanks";

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function itemIdent(q: QuizQuestion, index: number): string {
  return q.id.replace(/[^a-zA-Z0-9_-]/g, "_") || `q${index + 1}`;
}

function questionToQtiItem(q: QuizQuestion, index: number): string {
  const ident = itemIdent(q, index);
  const title = escXml((q.prompt || `Question ${index + 1}`).slice(0, 80));
  const prompt = escXml(q.prompt || "");

  if (q.type === "multiple_choice" || q.type === "true_false") {
    const choices = q.choices ?? (q.type === "true_false" ? ["True", "False"] : []);
    const correct = q.correctChoiceIndex ?? 0;
    const responses = choices
      .map(
        (c, i) =>
          `      <response_label ident="A${i}"><material><mattext texttype="text/plain">${escXml(c)}</mattext></material></response_label>`,
      )
      .join("\n");
    return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_lid ident="response1" rcardinality="Single">
        <render_choice>
${responses}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes><decvar vartype="Decimal" varname="SCORE" defaultval="0"/></outcomes>
      <respcondition continue="No">
        <conditionvar><varequal respident="response1">A${correct}</varequal></conditionvar>
        <setvar action="Set" varname="SCORE">100</setvar>
      </respcondition>
    </resprocessing>
  </item>`;
  }

  if (q.type === "multiple_answers") {
    const choices = q.choices ?? [];
    const correct = new Set(q.correctChoiceIndices ?? []);
    const responses = choices
      .map(
        (c, i) =>
          `      <response_label ident="A${i}"><material><mattext texttype="text/plain">${escXml(c)}</mattext></material></response_label>`,
      )
      .join("\n");
    const conds = [...correct]
      .map((i) => `<varequal respident="response1">A${i}</varequal>`)
      .join("");
    return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_lid ident="response1" rcardinality="Multiple">
        <render_choice>
${responses}
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <outcomes><decvar vartype="Decimal" varname="SCORE" defaultval="0"/></outcomes>
      <respcondition continue="No">
        <conditionvar><and>${conds}</and></conditionvar>
        <setvar action="Set" varname="SCORE">100</setvar>
      </respcondition>
    </resprocessing>
  </item>`;
  }

  if (q.type === "numerical") {
    const target = q.correctNumber ?? 0;
    const margin = q.tolerance ?? 0;
    return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_num ident="response1" rcardinality="Single" numtype="Decimal">
        <render_fib fibtype="Number"><response_label ident="answer"/></render_fib>
      </response_num>
    </presentation>
    <resprocessing>
      <outcomes><decvar vartype="Decimal" varname="SCORE" defaultval="0"/></outcomes>
      <respcondition continue="No">
        <conditionvar>
          <vargte respident="response1">${target - margin}</vargte>
          <varlte respident="response1">${target + margin}</varlte>
        </conditionvar>
        <setvar action="Set" varname="SCORE">100</setvar>
      </respcondition>
    </resprocessing>
  </item>`;
  }

  if (q.type === "matching" && (q.matchingPairs?.length ?? 0) > 0) {
    const pairs = q.matchingPairs!;
    const left = pairs
      .map(
        (p, i) =>
          `      <response_label ident="L${i}"><material><mattext texttype="text/plain">${escXml(p.left)}</mattext></material></response_label>`,
      )
      .join("\n");
    const right = pairs
      .map(
        (p, i) =>
          `      <response_label ident="R${i}"><material><mattext texttype="text/plain">${escXml(p.right)}</mattext></material></response_label>`,
      )
      .join("\n");
    return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_grp ident="response1" rcardinality="Multiple">
        <render_choice>
${left}
${right}
        </render_choice>
      </response_grp>
    </presentation>
  </item>`;
  }

  if (q.type === "short_answer" || q.type === "fill_in_blank") {
    const answers = (q.acceptedAnswers ?? []).map((a) => escXml(a));
    const conds = answers
      .map((a) => `<varequal respident="response1" casesensitive="No">${a}</varequal>`)
      .join("");
    return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_str ident="response1" rcardinality="Single">
        <render_fib fibtype="String"><response_label ident="answer"/></render_fib>
      </response_str>
    </presentation>
    ${
      answers.length
        ? `<resprocessing>
      <outcomes><decvar vartype="Decimal" varname="SCORE" defaultval="0"/></outcomes>
      <respcondition continue="No">
        <conditionvar>${conds}</conditionvar>
        <setvar action="Set" varname="SCORE">100</setvar>
      </respcondition>
    </resprocessing>`
        : ""
    }
  </item>`;
  }

  // Essay / coding / inline_code / note fallback → extended text
  return `  <item ident="${ident}" title="${title}">
    <presentation>
      <material><mattext texttype="text/plain">${prompt}</mattext></material>
      <response_str ident="response1" rcardinality="Single">
        <render_fib fibtype="String"><response_label ident="answer"/></render_fib>
      </response_str>
    </presentation>
  </item>`;
}

function flattenForExport(questions: QuizQuestion[]): {
  items: string[];
  sections: string[];
} {
  const items: string[] = [];
  const sections: string[] = [];
  let index = 0;
  for (const q of normalizeQuizQuestions(questions)) {
    if (q.type === "note") {
      sections.push(
        `    <!-- Note: ${escXml((q.prompt || "").slice(0, 120))} -->`,
      );
      continue;
    }
    if (q.type === "group") {
      const kids = q.groupQuestions ?? [];
      const childXml = kids
        .map((gq) => {
          const xml = questionToQtiItem(gq, index);
          index += 1;
          return xml
            .split("\n")
            .map((line) => (line ? `  ${line}` : line))
            .join("\n");
        })
        .join("\n");
      sections.push(`    <section ident="${itemIdent(q, index)}" title="${escXml((q.prompt || "Group").slice(0, 80))}">
${childXml}
    </section>`);
      index += 1;
      continue;
    }
    items.push(questionToQtiItem(q, index));
    index += 1;
  }
  return { items, sections };
}

function wrapAssessment(ident: string, title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${escXml(ident)}" title="${escXml(title)}">
    <section ident="root">
${body}
    </section>
  </assessment>
</questestinterop>
`;
}

/** Richer QTI 1.2 quiz XML (MC/multi/TF/numerical/matching/FIB + groups as sections). */
export function exportQuizToQtiXml(quiz: Quiz): string {
  const { items, sections } = flattenForExport(quiz.questions ?? []);
  const body = [...items, ...sections].join("\n");
  return wrapAssessment(quiz.id, quiz.title || "Quiz", body);
}

/** Export a question bank as QTI 1.2 assessment XML. */
export function exportBankToQtiXml(bank: QuestionBank): string {
  const { items, sections } = flattenForExport(bank.questions ?? []);
  const body = [...items, ...sections].join("\n");
  return wrapAssessment(bank.id, bank.title || "Question bank", body);
}

export function quizQtiFilename(title: string): string {
  return quizExportFilename(title).replace(/\.json$/i, ".qti.xml");
}

export function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
