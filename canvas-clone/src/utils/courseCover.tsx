import { useState } from "react";
import type { Course } from "./coursesStore";

const COVERS = {
  algorithms:
    "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1400&q=70",
  chalkboard:
    "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1400&q=70",
  language:
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=70",
  typewriter:
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=70",
  library:
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1400&q=70",
  code: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=70",
  campus:
    "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1400&q=70",
  studio:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=70",
  science:
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=70",
  network:
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=70",
} as const;

const BY_ID: Record<string, string> = {
  "1": COVERS.algorithms,
  "2": COVERS.language,
};

const KEYWORDS: [RegExp, string][] = [
  [/algo|complex|discrete|graph theory|combinator/i, COVERS.chalkboard],
  [/nlp|language|linguis|rhetoric|speech|translat/i, COVERS.language],
  [/machine|neural|deep learn|artificial|ai\b/i, COVERS.network],
  [/code|program|software|compil|operat/i, COVERS.code],
  [/web|hci|design|studio|interact/i, COVERS.studio],
  [/bio|chem|physics|lab|science/i, COVERS.science],
  [/data|database|informat/i, COVERS.network],
  [/write|literat|english|humanit|histor/i, COVERS.typewriter],
];

const FALLBACKS = [COVERS.library, COVERS.campus, COVERS.studio, COVERS.code];

function hashPick(seed: string, urls: readonly string[]) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 997;
  return urls[n % urls.length];
}

export function getCourseCoverUrls(course: Pick<Course, "id" | "title" | "code" | "short_name">) {
  const primary = BY_ID[course.id]
    ?? KEYWORDS.find(([re]) => re.test(`${course.title} ${course.code} ${course.short_name}`))?.[1]
    ?? hashPick(course.id, FALLBACKS);
  const extras = FALLBACKS.filter((url) => url !== primary);
  return [primary, ...extras];
}

export function getCourseCover(course: Pick<Course, "id" | "title" | "code" | "short_name">) {
  return getCourseCoverUrls(course)[0];
}

export function CourseCoverImage({
  course,
  className,
}: {
  course: Pick<Course, "id" | "title" | "code" | "short_name">;
  className?: string;
}) {
  const urls = getCourseCoverUrls(course);
  const [index, setIndex] = useState(0);
  const src = urls[index];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setIndex((n) => n + 1)}
    />
  );
}
