import type { QuestionBank } from "../utils/questionBanks";
import { buildCoreDemoQuestionBanks, buildNewDemoQuestionBanks } from "./demoBanks";
import { demoQuestionBankIds as coreDemoQuestionBankIds } from "./demoBanks/catalog";

/** Bump when seed bank content should refresh for existing courses. */
export const DEMO_QUESTION_BANKS_REVISION = 14;

const seedBankCache = new Map<string, QuestionBank[]>();

/** Stable demo bank ids so seeds can be re-merged per course. */
export function demoQuestionBankIds(courseId: string) {
  return coreDemoQuestionBankIds(courseId);
}

export function buildDemoQuestionBanks(courseId: string): QuestionBank[] {
  const hit = seedBankCache.get(courseId);
  if (hit) return hit;
  const built = [...buildCoreDemoQuestionBanks(courseId), ...buildNewDemoQuestionBanks(courseId)];
  seedBankCache.set(courseId, built);
  return built;
}

export function countDemoQuestions(courseId: string): number {
  return buildDemoQuestionBanks(courseId).reduce((n, b) => n + b.questions.length, 0);
}
