import { describe, expect, it } from "vitest";
import { parseAnyQuestionImport, remapImportedQuestions, resolveImportTitle } from "./quizImportFormats";

const QTI = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="a1" title="Sample QTI">
    <section ident="root">
      <item ident="i1" title="Q1">
        <presentation>
          <material><mattext texttype="text/plain">2 + 2 = ?</mattext></material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="A0"><material><mattext>3</mattext></material></response_label>
              <response_label ident="A1"><material><mattext>4</mattext></material></response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <respcondition><conditionvar><varequal respident="response1">A1</varequal></conditionvar></respcondition>
        </resprocessing>
      </item>
    </section>
  </assessment>
</questestinterop>`;

const MOODLE = `<?xml version="1.0"?>
<quiz>
  <question type="truefalse">
    <name><text>TF</text></name>
    <questiontext><text>The sky is blue.</text></questiontext>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
</quiz>`;

const AIKEN = `Which planet is closest to the sun?
A. Venus
B. Mercury
ANSWER: B
`;

const CSV = `type,prompt,points,answer,choices
multiple_choice,"What is 2+2?",1,4,"1|2|3|4"`;

const MD = `## Define recursion
type: essay
points: 5`;

describe("round trips", () => {
  it("re-imports exported quiz QTI", async () => {
    const { exportQuizToQtiXml } = await import("./quizQtiExport");
    const { createQuizQuestion } = await import("./quizzes");
    const mc = createQuizQuestion("multiple_choice");
    mc.prompt = "Pick B";
    mc.choices = ["A", "B", "C"];
    mc.correctChoiceIndex = 1;
    const ma = createQuizQuestion("multiple_answers");
    ma.prompt = "Pick A and C";
    ma.choices = ["A", "B", "C"];
    ma.correctChoiceIndices = [0, 2];
    const xml = exportQuizToQtiXml({ id: "q1", title: "Export me", questions: [mc, ma] });
    const back = parseAnyQuestionImport("export me.qti.xml", xml);
    expect(back.title).toBe("Export me");
    expect(back.questions).toHaveLength(2);
    expect(back.questions[0]!.type).toBe("multiple_choice");
    expect(back.questions[0]!.correctChoiceIndex).toBe(1);
    expect(back.questions[1]!.type).toBe("multiple_answers");
    expect(back.questions[1]!.correctChoiceIndices).toEqual([0, 2]);
  });

  it("round-trips quiz settings including softOriginality", async () => {
    const { applyQuizExportSettings, buildQuizExportSettings } = await import("./quizExport");
    const base = {
      id: "q1",
      title: "T",
      softOriginality: { enabled: true, minMatchWords: 8 },
      lockOnLeave: true,
      allowedAttempts: 3,
      accessCode: "abc",
    } as Parameters<typeof buildQuizExportSettings>[0];
    const settings = buildQuizExportSettings(base);
    const applied = applyQuizExportSettings({ id: "q2", title: "New" }, settings);
    expect(applied.softOriginality).toEqual({ enabled: true, minMatchWords: 8 });
    expect(applied.lockOnLeave).toBe(true);
    expect(applied.allowedAttempts).toBe(3);
    expect(applied.accessCode).toBe("abc");
    expect(applied.title).toBe("New");
  });
});

describe("parseAnyQuestionImport", () => {
  it("routes QTI XML", () => {
    const b = parseAnyQuestionImport("export.xml", QTI);
    expect(b.format).toBe("qti");
    expect(b.title).toBe("Sample QTI");
    expect(b.questions).toHaveLength(1);
    expect(b.questions[0]!.correctChoiceIndex).toBe(1);
  });

  it("routes Moodle XML", () => {
    const b = parseAnyQuestionImport("moodle.xml", MOODLE);
    expect(b.format).toBe("moodle");
    expect(b.questions[0]!.type).toBe("true_false");
  });

  it("routes Aiken text", () => {
    const b = parseAnyQuestionImport("bank.txt", AIKEN);
    expect(b.format).toBe("aiken");
    expect(b.questions[0]!.correctChoiceIndex).toBe(1);
  });

  it("still routes CSV and Markdown bank formats", () => {
    expect(parseAnyQuestionImport("bank.csv", CSV).questions[0]!.type).toBe("multiple_choice");
    expect(parseAnyQuestionImport("bank.md", MD).questions[0]!.type).toBe("essay");
  });

  it("remaps ids and resolves title conflicts", () => {
    const b = parseAnyQuestionImport("export.xml", QTI);
    const copies = remapImportedQuestions(b.questions);
    expect(copies[0]!.id).not.toBe(b.questions[0]!.id);
    expect(resolveImportTitle("Quiz 1", ["Quiz 1"], "rename")).toBe("Quiz 1 (imported)");
    expect(resolveImportTitle("Quiz 1", ["Quiz 1"], "skip")).toBeNull();
    expect(resolveImportTitle("Quiz 1", ["Quiz 1"], "replace")).toBe("Quiz 1");
  });
});
