/**
 * Safe numeric formula evaluation for calculated quiz questions.
 * Supports +, -, *, /, ^, parentheses, and single-letter variables.
 */

const ALLOWED = /^[\d\s+\-*/().^a-zA-Z_]+$/;

function replaceVars(expr: string, vars: Record<string, number>): string {
  let out = expr;
  for (const [name, val] of Object.entries(vars)) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    out = out.replace(re, String(val));
  }
  return out;
}

/** Evaluate a formula with numeric variables. Returns NaN on invalid input. */
export function evaluateFormula(
  formula: string,
  vars: Record<string, number>,
): number {
  const trimmed = formula.trim();
  if (!trimmed || !ALLOWED.test(trimmed)) return NaN;
  const substituted = replaceVars(trimmed, vars).replace(/\^/g, "**");
  if (!ALLOWED.test(substituted.replace(/\*\*/g, "^"))) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${substituted});`);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

export type CalculatedVariable = {
  name: string;
  min: number;
  max: number;
  decimals?: number;
};

/** Deterministic pseudo-random vars from a seed string. */
export function generateCalculatedVariables(
  defs: CalculatedVariable[],
  seed: string,
): Record<string, number> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: Record<string, number> = {};
  for (const def of defs) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const t = h / 0xffffffff;
    const min = Math.min(def.min, def.max);
    const max = Math.max(def.min, def.max);
    let val = min + t * (max - min);
    const dec = def.decimals ?? 0;
    if (dec > 0) {
      const m = 10 ** dec;
      val = Math.round(val * m) / m;
    } else {
      val = Math.round(val);
    }
    out[def.name] = val;
  }
  return out;
}

export function substituteCalculatedPrompt(
  prompt: string,
  vars: Record<string, number>,
): string {
  let out = prompt;
  for (const [name, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\[${name}\\]`, "gi"), String(val));
  }
  return out;
}
