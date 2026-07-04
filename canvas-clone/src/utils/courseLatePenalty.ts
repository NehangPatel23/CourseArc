import type { LatePenaltyPreset, LatePenaltyTimeUnit } from "./latePenalty";

export type CourseCustomLatePenaltyPreset = {
  id: string;
  label: string;
  type: "percent_per_unit" | "points_per_unit" | "percent_flat" | "points_flat";
  unit: LatePenaltyTimeUnit;
  value: number;
  maxPercent?: number;
};

export function createCustomLatePenaltyPresetId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function unitLabel(unit: LatePenaltyTimeUnit, perInterval = true): string {
  if (!perInterval) return "";
  switch (unit) {
    case "minutes":
      return "minute";
    case "hours":
      return "hour";
    case "days":
      return "day";
  }
}

export function describeLatePenaltyPreset(
  preset: Pick<CourseCustomLatePenaltyPreset, "type" | "value" | "unit" | "maxPercent">,
): string {
  switch (preset.type) {
    case "percent_per_unit":
      return preset.maxPercent != null
        ? `Deduct ${preset.value}% of the base score for each ${unitLabel(preset.unit)} late (max ${preset.maxPercent}%)`
        : `Deduct ${preset.value}% of the base score for each ${unitLabel(preset.unit)} late`;
    case "points_per_unit":
      return `Deduct ${preset.value} point${preset.value === 1 ? "" : "s"} for each ${unitLabel(preset.unit)} late`;
    case "percent_flat":
      return `Deduct ${preset.value}% of the base score once`;
    case "points_flat":
      return `Deduct ${preset.value} point${preset.value === 1 ? "" : "s"} once`;
    default:
      return "";
  }
}

export function toLatePenaltyPreset(
  preset: CourseCustomLatePenaltyPreset,
): LatePenaltyPreset {
  const typeMap = {
    percent_per_unit: "percent_per_day",
    points_per_unit: "points_per_day",
    percent_flat: "percent_flat",
    points_flat: "points_flat",
  } as const;

  return {
    id: preset.id,
    label: preset.label,
    type: typeMap[preset.type],
    value: preset.value,
    unit: preset.type === "percent_per_unit" || preset.type === "points_per_unit"
      ? preset.unit
      : undefined,
    maxPercent: preset.maxPercent,
    description: describeLatePenaltyPreset(preset),
  };
}

export function migrateLegacyCustomPreset(
  preset: CourseCustomLatePenaltyPreset & { type?: string },
): CourseCustomLatePenaltyPreset {
  const legacyType = preset.type as string;
  if (legacyType === "percent_per_day") {
    return {
      ...preset,
      type: "percent_per_unit",
      unit: preset.unit ?? "days",
    };
  }
  if (legacyType === "points_per_day") {
    return {
      ...preset,
      type: "points_per_unit",
      unit: preset.unit ?? "days",
    };
  }
  return {
    ...preset,
    unit: preset.unit ?? "days",
  };
}

export function normalizeCustomLatePenaltyPreset(
  preset: CourseCustomLatePenaltyPreset,
): CourseCustomLatePenaltyPreset | null {
  const migrated = migrateLegacyCustomPreset(preset);
  const label = migrated.label.trim();
  if (!label) return null;
  const value = Number(migrated.value);
  if (!Number.isFinite(value) || value < 0) return null;
  const maxPercent =
    migrated.type === "percent_per_unit" && migrated.maxPercent != null
      ? Math.max(0, Number(migrated.maxPercent))
      : undefined;
  return {
    id: migrated.id || createCustomLatePenaltyPresetId(),
    label,
    type: migrated.type,
    unit: migrated.unit,
    value,
    maxPercent,
  };
}

export function isIntervalPenaltyType(type: CourseCustomLatePenaltyPreset["type"]): boolean {
  return type === "percent_per_unit" || type === "points_per_unit";
}
