import { useParams } from "react-router-dom";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { loadPortfolioDoc } from "../utils/ePortfolioStore";
import { getRosterMemberName, loadRoster } from "../utils/courseRoster";
import { loadCourses } from "../utils/coursesStore";

export default function PublicPortfolioPage() {
  const { studentId } = useParams();
  const id = studentId ?? "";
  const doc = loadPortfolioDoc(id);
  const name =
    loadCourses(true)
      .map((c) => getRosterMemberName(c.id, id))
      .find((n) => n && n !== id) ??
    loadRoster(loadCourses(true)[0]?.id ?? "")?.find((m) => m.id === id)?.name ??
    id;

  return (
    <div className="paper-grain min-h-screen bg-arc-paper">
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10">
      <PageIdentityHeader
        icon="briefcase"
        label="Public ArcFolio"
        title={name}
        description={doc.headline || "Read-only shared portfolio"}
      />
      {doc.bio && <p className="mt-4 text-sm leading-relaxed text-arc-ink/70">{doc.bio}</p>}
      {doc.skills && doc.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {doc.skills.map((s) => (
            <li key={s} className="bg-arc-copper/10 px-2 py-0.5 text-xs text-arc-copper">
              {s}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-8 grid gap-4">
        {doc.entries.map((e, i) => (
          <li key={e.id} className="relative bg-arc-ivory p-5 ring-1 ring-arc-ink/10">
            <span className="absolute right-4 top-4 font-display text-xs tracking-[0.18em] text-arc-mute">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="kicker text-arc-copper">Plate</p>
            <p className="mt-1 font-display text-xl font-medium text-arc-ink">{e.title}</p>
            {e.description && <p className="mt-1 text-sm text-arc-ink/70">{e.description}</p>}
            {e.note && <p className="mt-1 text-sm text-arc-mute">{e.note}</p>}
            {e.url && (
              <a href={e.url} className="mt-2 inline-block text-sm text-arc-copper hover:underline">
                {e.url}
              </a>
            )}
          </li>
        ))}
        {doc.entries.length === 0 && (
          <p className="text-sm text-arc-mute">This student has not added portfolio items yet.</p>
        )}
      </ul>
    </div>
    </div>
  );
}
