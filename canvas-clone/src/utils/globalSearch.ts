import { loadAnnouncements } from "./announcements";
import { loadCourses } from "./coursesStore";
import { loadFilesMeta } from "./files";
import { loadModulesFromStorage } from "./modules";
import { recordSearchQuery } from "./searchHistory";
import { searchFaq } from "./faq";
import { getCourseNickname } from "./courseNicknames";
import { loadAppointmentGroups } from "./appointmentGroups";
import { listCustomCalendarEvents } from "./calendarCustomEvents";
import { loadSyllabus } from "./syllabus";

export type SearchResultGroup =
  | "courses"
  | "pages"
  | "files"
  | "announcements"
  | "events"
  | "appointments"
  | "help";

export type SearchResult = {
  id: string;
  group: SearchResultGroup;
  title: string;
  subtitle?: string;
  href: string;
  courseId?: string;
  score: number;
};

function scoreMatch(text: string, q: string): number {
  const lower = text.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 50;
  return 0;
}

export function globalSearch(query: string, limit = 20): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  const courses = loadCourses(false);

  for (const c of courses) {
    const nick = getCourseNickname(c.id);
    const s = Math.max(
      scoreMatch(c.title, q),
      scoreMatch(c.code, q),
      scoreMatch(c.short_name, q),
      nick ? scoreMatch(nick, q) : 0,
    );
    if (s > 0) {
      results.push({
        id: `course-${c.id}`,
        group: "courses",
        title: nick ? `${nick} (${c.title})` : c.title,
        subtitle: c.code,
        href: `/courses/${c.id}/home`,
        courseId: c.id,
        score: s + 10,
      });
    }
  }

  const modules = loadModulesFromStorage();
  for (const c of courses) {
    for (const mod of modules) {
      for (const item of mod.items as {
        type?: string;
        label?: string;
        pageId?: string;
        fileId?: string;
      }[]) {
        if (!item.label) continue;
        const s = scoreMatch(item.label, q);
        if (s <= 0) continue;
        if (item.type === "page" && item.pageId) {
          results.push({
            id: `page-${c.id}-${item.pageId}`,
            group: "pages",
            title: item.label,
            subtitle: `${c.short_name} · ${mod.title}`,
            href: `/courses/${c.id}/pages/${item.pageId}/view`,
            courseId: c.id,
            score: s,
          });
        }
      }
    }
    for (const f of loadFilesMeta(c.id)) {
      const s = scoreMatch(f.name, q);
      if (s > 0) {
        results.push({
          id: `file-${c.id}-${f.id}`,
          group: "files",
          title: f.name,
          subtitle: c.short_name,
          href: `/courses/${c.id}/files/${f.id}`,
          courseId: c.id,
          score: s,
        });
      }
    }
    for (const a of loadAnnouncements(c.id)) {
      const s = scoreMatch(a.title, q);
      if (s > 0) {
        results.push({
          id: `ann-${c.id}-${a.id}`,
          group: "announcements",
          title: a.title,
          subtitle: c.short_name,
          href: `/courses/${c.id}/announcements/${a.id}`,
          courseId: c.id,
          score: s,
        });
      }
    }
    const syllabus = loadSyllabus(c.id);
    const sylScore = Math.max(scoreMatch("syllabus", q), scoreMatch(syllabus.content.replace(/<[^>]+>/g, " "), q));
    if (sylScore > 0) {
      results.push({
        id: `syllabus-${c.id}`,
        group: "pages",
        title: "Syllabus",
        subtitle: c.short_name,
        href: `/courses/${c.id}/syllabus`,
        courseId: c.id,
        score: sylScore,
      });
    }
  }

  for (const e of listCustomCalendarEvents({ courseId: "all" })) {
    const s = scoreMatch(e.title, q);
    if (s > 0) {
      results.push({
        id: `event-${e.id}`,
        group: "events",
        title: e.title,
        subtitle: e.location ?? "Calendar event",
        href: `/calendar?event=${encodeURIComponent(e.id)}`,
        courseId: e.courseId ?? undefined,
        score: s,
      });
    }
  }
  for (const c of courses) {
    for (const g of loadAppointmentGroups(c.id)) {
      const s = scoreMatch(g.title, q);
      if (s > 0) {
        results.push({
          id: `appt-${g.id}`,
          group: "appointments",
          title: g.title,
          subtitle: c.short_name,
          href: `/calendar?appointment=${encodeURIComponent(g.id)}&course=${encodeURIComponent(c.id)}`,
          courseId: c.id,
          score: s,
        });
      }
    }
  }

  for (const item of searchFaq(query).slice(0, 6)) {
    results.push({
      id: `faq-${item.id}`,
      group: "help",
      title: item.title,
      subtitle: `Help · ${item.category}`,
      href: `/help?q=${encodeURIComponent(item.title)}`,
      score: 40,
    });
  }

  recordSearchQuery(query);
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function groupSearchResults(results: SearchResult[]) {
  const groups: Record<SearchResultGroup, SearchResult[]> = {
    courses: [],
    pages: [],
    files: [],
    announcements: [],
    events: [],
    appointments: [],
    help: [],
  };
  for (const r of results) groups[r.group].push(r);
  return groups;
}
