import { useParams } from "react-router-dom";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { loadPortfolioDoc } from "../utils/ePortfolioStore";
import { getRosterMemberName, loadRoster } from "../utils/courseRoster";
import { loadCourses } from "../utils/coursesStore";
import { Briefcase } from "lucide-react";

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
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10">
      <PageIdentityHeader
        icon={Briefcase}
        label="Public ArcFolio"
        title={name}
        description={doc.headline || "Read-only shared portfolio"}
      />
      {doc.bio && <p className="mt-4 text-sm text-gray-700">{doc.bio}</p>}
      {doc.skills && doc.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {doc.skills.map((s) => (
            <li
              key={s}
              className="rounded-full bg-canvas-blueTint px-2 py-0.5 text-xs text-canvas-blueDark"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-8 space-y-3">
        {doc.entries.map((e) => (
          <li key={e.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-canvas-grayDark">{e.title}</p>
            {e.description && <p className="mt-1 text-sm text-gray-600">{e.description}</p>}
            {e.note && <p className="mt-1 text-sm text-gray-500">{e.note}</p>}
            {e.url && (
              <a href={e.url} className="mt-2 inline-block text-sm text-canvas-blue hover:underline">
                {e.url}
              </a>
            )}
          </li>
        ))}
        {doc.entries.length === 0 && (
          <p className="text-sm text-gray-500">This student has not added portfolio items yet.</p>
        )}
      </ul>
    </div>
  );
}
