export type LatePenaltyTimeUnit = "minutes" | "hours" | "days";

export type LatePenaltyPreset = {
  id: string;
  label: string;
  description: string;
  type: "percent_per_day" | "points_per_day" | "percent_flat" | "points_flat" | "manual";
  value: number;
  unit?: LatePenaltyTimeUnit;
  maxPercent?: number;
};

export const MANUAL_LATE_PENALTY_PRESET_ID = "manual";
export const DEFAULT_LATE_PENALTY_PRESET_ID = "pct-10-day";

export const LATE_PENALTY_TIME_UNITS: LatePenaltyTimeUnit[] = ["minutes", "hours", "days"];

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function getBuiltinLatePenaltyPresets(): LatePenaltyPreset[] {
  return [
    {
      id: "pct-10-day",
      label: "10% per day",
      description: "Deduct 10% of the base score for each day late (max 50%)",
      type: "percent_per_day",
      value: 10,
      unit: "days",
      maxPercent: 50,
    },
    {
      id: "pts-5-day",
      label: "5 points per day",
      description: "Deduct 5 points for each day late",
      type: "points_per_day",
      value: 5,
      unit: "days",
    },
    {
      id: "pct-10-flat",
      label: "10% flat",
      description: "Deduct 10% of the base score once",
      type: "percent_flat",
      value: 10,
    },
    {
      id: "pts-15-flat",
      label: "15 points flat",
      description: "Deduct 15 points once",
      type: "points_flat",
      value: 15,
    },
  ];
}

function getManualLatePenaltyPreset(): LatePenaltyPreset {
  return {
    id: MANUAL_LATE_PENALTY_PRESET_ID,
    label: "Manual adjustment",
    description: "Enter a custom point deduction",
    type: "manual",
    value: 0,
  };
}

export function getDefaultLatePenaltyPresets(): LatePenaltyPreset[] {
  return [...getBuiltinLatePenaltyPresets(), getManualLatePenaltyPreset()];
}

export function getLatePenaltyPresets(customPresets: LatePenaltyPreset[] = []): LatePenaltyPreset[] {
  return [...getDefaultLatePenaltyPresets(), ...customPresets];
}

export function getLatePenaltyPreset(
  id: string,
  customPresets: LatePenaltyPreset[] = [],
): LatePenaltyPreset {
  return (
    getLatePenaltyPresets(customPresets).find((preset) => preset.id === id) ??
    getLatePenaltyPresets(customPresets)[0]!
  );
}

export function lateDuration(
  dueAt: number | undefined,
  submittedAt: number,
  unit: LatePenaltyTimeUnit = "days",
): number {
  if (!dueAt || submittedAt <= dueAt) return 0;
  const msLate = submittedAt - dueAt;
  switch (unit) {
    case "minutes":
      return Math.ceil(msLate / MS_PER_MINUTE);
    case "hours":
      return Math.ceil(msLate / MS_PER_HOUR);
    case "days":
      return Math.ceil(msLate / MS_PER_DAY);
  }
}

export function daysLate(dueAt: number | undefined, submittedAt: number): number {
  return lateDuration(dueAt, submittedAt, "days");
}

export function formatLateDuration(count: number, unit: LatePenaltyTimeUnit): string {
  const labels: Record<LatePenaltyTimeUnit, [string, string]> = {
    minutes: ["minute", "minutes"],
    hours: ["hour", "hours"],
    days: ["day", "days"],
  };
  const [singular, plural] = labels[unit];
  return `${count} ${count === 1 ? singular : plural}`;
}

export function isLateSubmission(
  submission: { late?: boolean; submittedAt: number },
  dueAt?: number,
): boolean {
  if (submission.late) return true;
  return lateDuration(dueAt, submission.submittedAt, "minutes") > 0;
}

/** Apply late status + preset penalty when submission is after due and not yet graded without late. */
export function shouldAutoApplyLatePenalty(
  submission: { late?: boolean; submittedAt: number; status: string },
  dueAt?: number,
): boolean {
  if (!dueAt || !isLateSubmission(submission, dueAt)) return false;
  if (submission.late) return false;
  if (submission.status === "graded") return false;
  return true;
}

export function computeAutoLatePenalty(
  baseScore: number,
  submittedAt: number,
  dueAt: number | undefined,
  presetId = DEFAULT_LATE_PENALTY_PRESET_ID,
  manualPenalty = 0,
  customPresets: LatePenaltyPreset[] = [],
): {
  penalty: number;
  finalScore: number;
  lateUnits: number;
  unit: LatePenaltyTimeUnit;
} {
  const preset = getLatePenaltyPreset(presetId, customPresets);
  const unit = preset.unit ?? "days";
  const lateUnits = lateDuration(dueAt, submittedAt, unit);
  const penalty = calculateLatePenalty(preset, baseScore, dueAt, submittedAt, manualPenalty);
  return {
    penalty,
    finalScore: finalScoreAfterPenalty(baseScore, penalty),
    lateUnits,
    unit,
  };
}

export function calculateLatePenalty(
  preset: LatePenaltyPreset,
  baseScore: number,
  dueAt: number | undefined,
  submittedAt: number,
  manualPenalty = 0,
): number {
  if (preset.type === "manual") {
    return Math.max(0, manualPenalty);
  }

  const unit = preset.unit ?? "days";
  const lateUnits = lateDuration(dueAt, submittedAt, unit);

  let penalty = 0;
  switch (preset.type) {
    case "percent_per_day": {
      let pct = preset.value * lateUnits;
      if (preset.maxPercent != null) pct = Math.min(pct, preset.maxPercent);
      penalty = (pct / 100) * baseScore;
      break;
    }
    case "points_per_day":
      penalty = preset.value * lateUnits;
      break;
    case "percent_flat":
      penalty = (preset.value / 100) * baseScore;
      break;
    case "points_flat":
      penalty = preset.value;
      break;
  }

  return Math.round(Math.min(baseScore, Math.max(0, penalty)) * 100) / 100;
}

export function finalScoreAfterPenalty(baseScore: number, penalty: number): number {
  return Math.max(0, Math.round((baseScore - penalty) * 100) / 100);
}

export function inferRawScore(
  score?: number,
  latePenalty?: number,
  rawScore?: number,
): number {
  if (typeof rawScore === "number") return rawScore;
  const finalScore = score ?? 0;
  return finalScore + (latePenalty ?? 0);
}
