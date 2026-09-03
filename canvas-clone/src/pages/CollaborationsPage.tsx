import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import RichContentViewer from "../components/RichContentViewer";
import RichPromptField from "../components/RichPromptField";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import {
  addCollaboration,
  COLLABORATIONS_CHANGED_EVENT,
  deleteCollaboration,
  loadCollaborations,
  type Collaboration,
  type CollaborationKind,
} from "../utils/collaborations";
import { loadUser } from "../utils/userStore";

export default function CollaborationsPage() {
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { canEditCourseContent: canEdit } = usePermissions();
  const { showToast } = useToast();
  const me = loadUser();

  const [rows, setRows] = useState<Collaboration[]>([]);
  const [tab, setTab] = useState<CollaborationKind>("document");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Collaboration | null>(null);

  useEffect(() => {
    const refresh = () => setRows(loadCollaborations(effectiveCourseId));
    refresh();
    window.addEventListener(COLLABORATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COLLABORATIONS_CHANGED_EVENT, refresh);
  }, [effectiveCourseId]);

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

  const filtered = rows.filter((r) => r.kind === tab);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    addCollaboration(effectiveCourseId, {
      kind: tab,
      title,
      url,
      notes,
      startsAt: startsAt ? new Date(startsAt).getTime() : undefined,
      createdBy: me.name,
      createdById: me.id,
    });
    setTitle("");
    setUrl("");
    setNotes("");
    setStartsAt("");
    showToast(tab === "conference" ? "Conference added" : "Document added", "positive", "created");
  };

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
        <PageIdentityHeader
          size="md"
          icon={tab === "conference" ? "video" : "file"}
          label="Collaborations"
          title="Collaborations"
          description="Link shared docs and video conferences. This demo stores URLs in your browser — it does not host Google Docs or Zoom."
        />

        <div className="mt-6 flex border-b border-gray-200 text-sm">
          {(["document", "conference"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-4 py-2.5 ${
                tab === id
                  ? "border-canvas-blue font-medium text-canvas-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {id === "document" ? "Documents" : "Conferences"}
            </button>
          ))}
        </div>

        {canEdit && (
          <form
            className="mt-6 max-w-xl rounded-xl border border-gray-200 bg-canvas-grayLight/40 p-4"
            onSubmit={submit}
          >
            <p className="text-sm font-semibold text-canvas-grayDark">
              {tab === "conference" ? "Add a conference" : "Add a document"}
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tab === "conference" ? "Office hours Zoom" : "Shared outline"}
              className="form-input mt-3 h-9"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="form-input mt-2 h-9"
            />
            {tab === "conference" && (
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="form-input mt-2 h-9"
              />
            )}
            <div className="mt-2">
              <RichPromptField
                value={notes}
                onChange={setNotes}
                courseId={effectiveCourseId}
                mountKey="collab-notes"
                placeholder="Optional notes"
                height={120}
                alwaysEdit
              />
            </div>
            <button type="submit" className="btn-canvas-primary mt-3 inline-flex items-center gap-1.5 text-sm">
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>
        )}

        {filtered.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
            {tab === "conference"
              ? "No conferences yet. Staff can add a join URL for a live session."
              : "No shared documents yet. Staff can add a Google Doc, Figma file, or other URL."}
          </p>
        ) : (
          <ul className="mt-6 max-w-2xl divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-canvas-blue hover:underline"
                  >
                    {row.title}
                  </a>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {row.createdBy}
                    {row.startsAt
                      ? ` · ${new Date(row.startsAt).toLocaleString()}`
                      : ""}
                  </p>
                  {row.notes ? (
                    <RichContentViewer
                      html={row.notes}
                      courseId={effectiveCourseId}
                      spacing="compact"
                      className="mt-1 text-sm text-gray-600"
                    />
                  ) : null}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(row)}
                    className="rounded p-1 text-gray-400 hover:text-canvas-red"
                    aria-label={`Delete ${row.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmActionModal
        isOpen={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.title}?`}
        description="The link will be removed from this course."
        confirmText="Delete"
        tone="danger"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteCollaboration(effectiveCourseId, pendingDelete.id);
            showToast("Collaboration deleted", "neutral", "deleted");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
