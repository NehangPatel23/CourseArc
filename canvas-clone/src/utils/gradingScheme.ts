import { getCourseById } from "./coursesStore";

export type LetterGradeBand = {
  letter: string;
  minPercent: number;
};

export type GradingScheme = {
  bands: LetterGradeBand[];
  showLetterGrades: boolean;
  showOverallPercent: boolean;
};

export const DEFAULT_GRADING_BANDS: LetterGradeBand[] = [
  { letter: "A+", minPercent: 97 },
  { letter: "A", minPercent: 93 },
  { letter: "A-", minPercent: 90 },
  { letter: "B+", minPercent: 87 },
  { letter: "B", minPercent: 83 },
  { letter: "B-", minPercent: 80 },
  { letter: "C+", minPercent: 77 },
  { letter: "C", minPercent: 73 },
  { letter: "C-", minPercent: 70 },
  { letter: "D+", minPercent: 67 },
  { letter: "D", minPercent: 63 },
  { letter: "F", minPercent: 0 },
];

export function getDefaultGradingScheme(): GradingScheme {
  return {
    bands: [...DEFAULT_GRADING_BANDS],
    showLetterGrades: true,
    showOverallPercent: true,
  };
}

export function getGradingScheme(courseId: string): GradingScheme {
  const course = getCourseById(courseId);
  const scheme = course?.gradingScheme;
  if (!scheme?.bands?.length) return getDefaultGradingScheme();
  return {
    bands: [...scheme.bands].sort((a, b) => b.minPercent - a.minPercent),
    showLetterGrades: scheme.showLetterGrades ?? true,
    showOverallPercent: scheme.showOverallPercent ?? true,
  };
}

export function percentToLetter(percent: number, scheme?: GradingScheme): string {
  const bands = (scheme?.bands?.length ? scheme.bands : DEFAULT_GRADING_BANDS).sort(
    (a, b) => b.minPercent - a.minPercent,
  );
  for (const band of bands) {
    if (percent >= band.minPercent) return band.letter;
  }
  return bands[bands.length - 1]?.letter ?? "F";
}

export function normalizeGradingBands(bands: LetterGradeBand[]): LetterGradeBand[] {
  return [...bands]
    .filter((b) => b.letter.trim().length > 0)
    .map((b) => ({ letter: b.letter.trim(), minPercent: Math.max(0, Math.min(100, b.minPercent)) }))
    .sort((a, b) => b.minPercent - a.minPercent);
}
