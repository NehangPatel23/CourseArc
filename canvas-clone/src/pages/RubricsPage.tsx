import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, Plus, Trash2 } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import CanvasModal from "../components/CanvasModal";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { getCourseById, loadCourses } from "../utils/coursesStore";
import {
  createEssayRubricCriterion,
  essayRubricRatings,
  sumRubricMaxPoints,
  withEssayCriterionPoints,
  type RubricCriterionDef,
} from "../utils/assignmentRubric";
import {
  copyLibraryRubric,
  deleteLibraryRubric,
  loadRubricLibrary,
  RUBRIC_LIBRARY_CHANGED_EVENT,
  saveLibraryRubric,
  type LibraryRubric,
} from "../utils/rubricLibrary";

export default function RubricsPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { canEditCourseContent: canEdit } = usePermissions();
  const { showToast } = useToast();

  const [rows, setRows] = useState<LibraryRubric[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState<RubricCriterionDef[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyCourseId, setCopyCourseId] = useState("");
  const [copyRubricId, setCopyRubricId] = useState("");

  useEffect(() => {
    const refresh = () => setRows(loadRubricLibrary(effectiveCourseId));
    refresh();
    window.addEventListener(RUBRIC_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(RUBRIC_LIBRARY_CHANGED_EVENT, refresh);
  }, [effectiveCourseId]);

  useEffect(() => {
    if (!selectedId) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setTitle(row.title);
    setCriteria(row.criteria);
  }, [selectedId, rows]);

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
          <p className="text-sm text-gray-600">Rubrics are managed by course staff.</p>
        </div>
      </div>
    );
  }

  const select = (row: LibraryRubric) => {
    setSelectedId(row.id);
    setTitle(row.title);
    setCriteria(row.criteria);
  };

  const create = () => {
    const created = saveLibraryRubric(effectiveCourseId, {
      title: "New rubric",
      criteria: [createEssayRubricCriterion("Criterion 1", 10)],
    });
    select(created);
    showToast("Rubric created", "positive");
  };

  const save = () => {
    if (!selectedId) return;
    saveLibraryRubric(effectiveCourseId, {
      id: selectedId,
      title,
      criteria,
    });
    showToast("Rubric saved", "positive");
  };

  const selected = rows.find((r) => r.id === selectedId);
  const otherCourses = useMemo(
    () => loadCourses(true).filter((c) => c.id !== effectiveCourseId),
    [effectiveCourseId, copyOpen],
  );
  const sourceRubrics = copyCourseId ? loadRubricLibrary(copyCourseId) : [];

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon="table"
          label="Rubrics"
          title="Rubrics"
          description="Reusable grading rubrics. Attach one on an assignment so GradePro uses it instead of the default criteria."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCopyOpen(true)}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Copy className="h-4 w-4" />
                Copy from course
              </button>
              <button type="button" onClick={create} className="btn-canvas-primary inline-flex items-center gap-1.5 text-sm">
                <Plus className="h-4 w-4" />
                New rubric
              </button>
            </div>
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-gray-200 p-3">
            {rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-gray-500">No rubrics yet.</p>
            ) : (
              <ul className="space-y-1">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => select(row)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        selectedId === row.id
                          ? "bg-canvas-blueTint font-medium text-canvas-blue"
                          : "text-canvas-grayDark hover:bg-gray-50"
                      }`}
                    >
                      {row.title}
                      <span className="mt-0.5 block text-xs font-normal text-gray-500">
                        {sumRubricMaxPoints(row.criteria)} pts · {row.criteria.length} criteria
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {selected ? (
            <div className="space-y-4 rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="form-label">Title</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteLibraryRubric(effectiveCourseId, selected.id);
                    setSelectedId(null);
                    showToast("Rubric deleted", "positive");
                  }}
                  className="mt-6 rounded p-1.5 text-canvas-red hover:bg-red-50"
                  aria-label="Delete rubric"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="form-section-title">Criteria</p>
                  <button
                    type="button"
                    className="text-sm font-medium text-canvas-blue hover:underline"
                    onClick={() =>
                      setCriteria((prev) => [
                        ...prev,
                        createEssayRubricCriterion(`Criterion ${prev.length + 1}`, 10),
                      ])
                    }
                  >
                    Add criterion
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Total {sumRubricMaxPoints(criteria)} pts
                </p>
                <div className="mt-3 space-y-3">
                  {criteria.map((c, index) => (
                    <div key={c.id} className="rounded-lg border border-gray-100 p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_88px_auto]">
                        <input
                          value={c.title}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((row, i) =>
                                i === index ? { ...row, title: e.target.value } : row,
                              ),
                            )
                          }
                          className="form-input h-9"
                        />
                        <input
                          type="number"
                          min={0}
                          value={c.points}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((row, i) =>
                                i === index
                                  ? withEssayCriterionPoints(row, Number(e.target.value) || 0)
                                  : row,
                              ),
                            )
                          }
                          className="form-input h-9"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCriteria((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="text-xs text-canvas-red"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={c.description}
                        onChange={(e) =>
                          setCriteria((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, description: e.target.value } : row,
                            ),
                          )
                        }
                        className="form-input mt-2 min-h-[64px]"
                        placeholder="Short description"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Ratings: {c.ratings.map((r) => `${r.label} (${r.points})`).join(" · ") ||
                          essayRubricRatings(c.id, c.points)
                            .map((r) => r.label)
                            .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={save} className="btn-canvas-primary">
                  Save rubric
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-200 px-5 py-16 text-center text-sm text-gray-500">
              Select a rubric or create one.
            </p>
          )}
        </div>
      </div>
      {copyOpen && (
        <CanvasModal
          title="Copy rubric from another course"
          onClose={() => setCopyOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCopyOpen(false)} className="btn-canvas-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={!copyCourseId || !copyRubricId}
                className="btn-canvas-primary disabled:opacity-50"
                onClick={() => {
                  const copied = copyLibraryRubric(copyCourseId, copyRubricId, effectiveCourseId);
                  if (!copied) {
                    showToast("Could not copy that rubric", "negative");
                    return;
                  }
                  select(copied);
                  setCopyOpen(false);
                  setCopyCourseId("");
                  setCopyRubricId("");
                  showToast(`Copied “${copied.title}”`, "positive");
                }}
              >
                Copy
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="form-label">Course</span>
              <select
                value={copyCourseId}
                onChange={(e) => {
                  setCopyCourseId(e.target.value);
                  setCopyRubricId("");
                }}
                className="form-input"
              >
                <option value="">Choose a course…</option>
                {otherCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="form-label">Rubric</span>
              <select
                value={copyRubricId}
                onChange={(e) => setCopyRubricId(e.target.value)}
                className="form-input"
                disabled={!copyCourseId}
              >
                <option value="">Choose a rubric…</option>
                {sourceRubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CanvasModal>
      )}
    </div>
  );
}
