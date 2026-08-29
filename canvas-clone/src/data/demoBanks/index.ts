import type { QuestionBank } from "../../utils/questionBanks";
import { normalizeQuizQuestions, type QuizQuestion } from "../../utils/quizzes";
import { enrichDemoQuestions } from "../demoBankHelpers";
import {
  CORE_DEMO_BANK_CATALOG,
  NEW_DEMO_BANK_CATALOG,
  demoQuestionBankIds,
  newDemoBankId,
  type DemoBankMeta,
} from "./catalog";
import { demoSeedMeta } from "./meta";

type PackPayload = {
  version?: number;
  title?: string;
  questions?: QuizQuestion[];
  exportedAt?: number;
};

const packModules = import.meta.glob("../bankPacks/*.json", {
  eager: true,
  import: "default",
}) as Record<string, PackPayload>;

function packByFile(file: string): PackPayload | undefined {
  const key = Object.keys(packModules).find((k) => k.endsWith(`/${file}`) || k.endsWith(file));
  return key ? packModules[key] : undefined;
}

function remapQuestion(
  q: QuizQuestion,
  slug: string,
  courseId: string,
  counter: { n: number },
): QuizQuestion {
  const n = counter.n++;
  const id = `seed_qq_${slug}_${n}_${courseId}`;
  return {
    ...q,
    id,
    matchingPairs: q.matchingPairs?.map((p, i) => ({
      ...p,
      id: `seed_mp_${slug}_${n}_${i}_${courseId}`,
    })),
    groupQuestions: q.groupQuestions?.map((gq) =>
      remapQuestion(gq, slug, courseId, counter),
    ),
    codeTests: q.codeTests?.map((t, i) => ({
      ...t,
      id: `seed_ct_${slug}_${n}_${i}_${courseId}`,
    })),
  };
}

function buildFromPack(
  meta: DemoBankMeta,
  courseId: string,
  bankId: string,
  idSlug: string,
  now: number,
): QuestionBank | null {
  const pack = packByFile(meta.file);
  if (!pack?.questions?.length) {
    console.warn(`[demoBanks] Missing or empty pack: ${meta.file}`);
    return null;
  }
  const counter = { n: 1 };
  const remapped = normalizeQuizQuestions(pack.questions).map((q) =>
    remapQuestion(q, idSlug, courseId, counter),
  );
  const offsetDays = Math.max(0, 50 - meta.num);
  const seed = demoSeedMeta(meta.slug);
  return {
    id: bankId,
    courseId,
    title: meta.title,
    notes: seed.notes,
    audience: seed.audience,
    difficulty: seed.difficulty,
    examUse: seed.examUse,
    status: seed.status,
    tags: seed.tags,
    questions: enrichDemoQuestions(remapped, courseId),
    createdAt: now - offsetDays * 86400000,
    updatedAt: now - offsetDays * 86400000,
  };
}

/** Original five banks with stable `seed_qb_dsa_*` (etc.) ids, full pack size. */
export function buildCoreDemoQuestionBanks(courseId: string): QuestionBank[] {
  const now = Date.now();
  const ids = demoQuestionBankIds(courseId);
  const banks: QuestionBank[] = [];

  for (const meta of CORE_DEMO_BANK_CATALOG) {
    const bank = buildFromPack(meta, courseId, ids[meta.idKey], meta.idKey, now);
    if (bank) banks.push(bank);
  }

  return banks;
}

/** Banks 6–46 from JSON packs. */
export function buildNewDemoQuestionBanks(courseId: string): QuestionBank[] {
  const now = Date.now();
  const banks: QuestionBank[] = [];

  for (const meta of NEW_DEMO_BANK_CATALOG) {
    const bank = buildFromPack(
      meta,
      courseId,
      newDemoBankId(meta.slug, courseId),
      meta.slug,
      now,
    );
    if (bank) banks.push(bank);
  }

  return banks;
}
