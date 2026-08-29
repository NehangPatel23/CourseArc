import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, Download, Plus, Search, Upload, UserCog, Users } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import PeopleTabBar from "../components/PeopleTabBar";
import { useToast } from "../components/ui/Toast";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import { getCourseById } from "../utils/coursesStore";
import {
  COURSE_ROSTER_CHANGED_EVENT,
  loadRoster,
  type RosterMember,
} from "../utils/courseRoster";
import {
  ACCOMMODATION_TIME_EXPLAINER,
  exportAccommodationsPayload,
  formatAccommodationGrantParts,
  getQuizAccommodation,
  importAccommodationsPayload,
  normalizeTimeMultiplier,
  QUIZ_ACCOMMODATIONS_CHANGED_EVENT,
  setQuizAccommodation,
} from "../utils/quizAccommodations";
import { matchesSearch } from "../utils/listFilters";
import { initialsFromName } from "../utils/avatar";

type Draft = {
  extraMinutes: string;
  extraAttempts: string;
  timeMultiplier: string;
  unlockAvailability: boolean;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  extraMinutes: "",
  extraAttempts: "",
  timeMultiplier: "",
  unlockAvailability: false,
  note: "",
};

function draftFromCourseWide(courseId: string, studentId: string): Draft {
  const row = getQuizAccommodation(courseId, studentId, null);
  return {
    extraMinutes: row?.extraMinutes ? String(row.extraMinutes) : "",
    extraAttempts: row?.extraAttempts ? String(row.extraAttempts) : "",
    timeMultiplier:
      row?.timeMultiplier && row.timeMultiplier > 1 ? String(row.timeMultiplier) : "",
    unlockAvailability: Boolean(row?.unlockAvailability),
    note: row?.note ?? "",
  };
}

function parseExtra(value: string): number | null {
  if (value.trim() === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseMultiplier(value: string): number | null {
  if (value.trim() === "") return 1;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return normalizeTimeMultiplier(n);
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    (a.extraMinutes.trim() || "0") === (b.extraMinutes.trim() || "0") &&
    (a.extraAttempts.trim() || "0") === (b.extraAttempts.trim() || "0") &&
    (a.timeMultiplier.trim() || "1") === (b.timeMultiplier.trim() || "1") &&
    Boolean(a.unlockAvailability) === Boolean(b.unlockAvailability) &&
    (a.note.trim() || "") === (b.note.trim() || "")
  );
}

function loadDraftMap(courseId: string, students: RosterMember[]): Record<string, Draft> {
  const next: Record<string, Draft> = {};
  for (const m of students) {
    next[m.id] = draftFromCourseWide(courseId, m.id);
  }
  return next;
}

function formatUpdatedAt(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function draftHasGrant(draft: Draft): boolean {
  return (
    (parseExtra(draft.extraMinutes) ?? 0) > 0 ||
    (parseExtra(draft.extraAttempts) ?? 0) > 0 ||
    (parseMultiplier(draft.timeMultiplier) ?? 1) > 1 ||
    draft.unlockAvailability ||
    Boolean(draft.note.trim())
  );
}

export default function PeopleAccommodationsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const course = courseId ? getCourseById(courseId) : null;
  const { studentView } = useStudentView(effectiveCourseId);
  const { canManageAccommodations } = usePermissions();
  const { showToast } = useToast();

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [search, setSearch] = useState("");
  const [onlyWithGrants, setOnlyWithGrants] = useState(false);
  const [baseline, setBaseline] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const accommodationsFileRef = useRef<HTMLInputElement>(null);

  const peoplePath = `/courses/${effectiveCourseId}/people`;

  const students = useMemo(
    () => roster.filter((m) => m.role === "student"),
    [roster],
  );

  useEffect(() => {
    if (!canManageAccommodations) navigate(peoplePath, { replace: true });
  }, [canManageAccommodations, navigate, peoplePath]);

  useEffect(() => {
    const refresh = () => setRoster(loadRoster(effectiveCourseId));
    refresh();
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refresh);
  }, [effectiveCourseId]);

  useEffect(() => {
    setDrafts((current) => {
      const hasDirty = students.some((m) => {
        const saved = draftFromCourseWide(effectiveCourseId, m.id);
        const draft = current[m.id];
        return draft != null && !draftsEqual(draft, saved);
      });
      if (hasDirty && Object.keys(current).length > 0) return current;
      const next = loadDraftMap(effectiveCourseId, students);
      setBaseline(next);
      return next;
    });
  }, [effectiveCourseId, students]);

  useEffect(() => {
    const onExternal = () => {
      setDrafts((current) => {
        const dirty = students.some((m) => {
          const b = baseline[m.id] ?? EMPTY_DRAFT;
          const d = current[m.id] ?? EMPTY_DRAFT;
          return !draftsEqual(d, b);
        });
        if (dirty) return current;
        const next = loadDraftMap(effectiveCourseId, students);
        setBaseline(next);
        return next;
      });
    };
    window.addEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onExternal);
    return () => window.removeEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onExternal);
  }, [effectiveCourseId, students, baseline]);

  const dirtyStudentIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of students) {
      const b = baseline[m.id] ?? EMPTY_DRAFT;
      const d = drafts[m.id] ?? EMPTY_DRAFT;
      if (!draftsEqual(d, b)) ids.push(m.id);
    }
    return ids;
  }, [students, baseline, drafts]);

  const isDirty = dirtyStudentIds.length > 0;
  const { leaveGuardModal } = useUnsavedChangesGuard(isDirty);

  const filtered = useMemo(() => {
    let list = students;
    if (search.trim()) {
      list = list.filter(
        (m) => matchesSearch(m.name, search) || matchesSearch(m.email ?? "", search),
      );
    }
    if (onlyWithGrants) {
      list = list.filter((m) => draftHasGrant(drafts[m.id] ?? EMPTY_DRAFT));
    }
    return list;
  }, [students, search, onlyWithGrants, drafts]);

  const grantedCount = useMemo(() => {
    return students.filter((m) => draftHasGrant(drafts[m.id] ?? EMPTY_DRAFT)).length;
  }, [students, drafts]);

  const filteredIds = useMemo(() => filtered.map((m) => m.id), [filtered]);
  const selectedVisibleCount = useMemo(
    () => filteredIds.filter((id) => selectedIds.has(id)).length,
    [filteredIds, selectedIds],
  );
  const allFilteredSelected =
    filteredIds.length > 0 && selectedVisibleCount === filteredIds.length;
  const selectedTargetIds = useMemo(
    () => [...selectedIds].filter((id) => students.some((m) => m.id === id)),
    [selectedIds, students],
  );

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

  const updateDraft = (studentId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? EMPTY_DRAFT), ...patch },
    }));
  };

  const bumpMinutes = (studentId: string, amount: number) => {
    const current = parseExtra(drafts[studentId]?.extraMinutes ?? "") ?? 0;
    updateDraft(studentId, { extraMinutes: String(current + amount) });
  };

  const bumpAttempts = (studentId: string, amount: number) => {
    const current = parseExtra(drafts[studentId]?.extraAttempts ?? "") ?? 0;
    updateDraft(studentId, { extraAttempts: String(current + amount) });
  };

  const clearStudentDraft = (studentId: string) => {
    updateDraft(studentId, { ...EMPTY_DRAFT });
  };

  const toggleSelected = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const bulkBumpMinutes = (amount: number) => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) {
        const current = parseExtra(next[id]?.extraMinutes ?? "") ?? 0;
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          extraMinutes: String(current + amount),
        };
      }
      return next;
    });
    showToast(
      `Added +${amount} minutes to ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const bulkBumpAttempts = (amount: number) => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) {
        const current = parseExtra(next[id]?.extraAttempts ?? "") ?? 0;
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          extraAttempts: String(current + amount),
        };
      }
      return next;
    });
    showToast(
      `Added +${amount} attempt${amount === 1 ? "" : "s"} to ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const bulkClear = () => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) next[id] = { ...EMPTY_DRAFT };
      return next;
    });
    showToast(
      `Cleared grants for ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const discardChanges = () => {
    setDrafts({ ...baseline });
    showToast("Changes discarded", "neutral");
  };

  const saveAll = () => {
    for (const studentId of dirtyStudentIds) {
      const draft = drafts[studentId] ?? EMPTY_DRAFT;
      if (
        parseExtra(draft.extraMinutes) == null ||
        parseExtra(draft.extraAttempts) == null ||
        parseMultiplier(draft.timeMultiplier) == null
      ) {
        showToast("Enter valid non-negative numbers (multiplier ≥ 1)", "negative");
        return;
      }
    }

    for (const studentId of dirtyStudentIds) {
      const draft = drafts[studentId] ?? EMPTY_DRAFT;
      setQuizAccommodation(effectiveCourseId, {
        studentId,
        quizId: null,
        extraMinutes: parseExtra(draft.extraMinutes) ?? 0,
        extraAttempts: parseExtra(draft.extraAttempts) ?? 0,
        timeMultiplier: parseMultiplier(draft.timeMultiplier) ?? 1,
        unlockAvailability: draft.unlockAvailability,
        note: draft.note,
      });
    }

    const next = loadDraftMap(effectiveCourseId, students);
    setBaseline(next);
    setDrafts(next);
    showToast(
      dirtyStudentIds.length === 1
        ? "Course-wide accommodation saved"
        : `Saved accommodations for ${dirtyStudentIds.length} students`,
      "positive",
    );
  };

  const exportAccommodations = () => {
    const payload = exportAccommodationsPayload(effectiveCourseId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accommodations-${effectiveCourseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Accommodations exported", "positive");
  };

  const importAccommodationsFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = importAccommodationsPayload(effectiveCourseId, parsed);
      if (result.error) {
        showToast(result.error, "negative");
        return;
      }
      const next = loadDraftMap(effectiveCourseId, students);
      setBaseline(next);
      setDrafts(next);
      showToast(
        result.imported === 1
          ? "Imported 1 accommodation"
          : `Imported ${result.imported} accommodations`,
        "positive",
      );
    } catch {
      showToast("Could not parse accommodations JSON", "negative");
    } finally {
      if (accommodationsFileRef.current) accommodationsFileRef.current.value = "";
    }
  };

  return (    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="bg-white px-8 pt-8">
          <PageIdentityHeader
            size="md"
            icon={Users}
            label="People"
            title="People"
            description="Course-wide quiz accommodations for every student."
          />
          <PeopleTabBar
            courseId={effectiveCourseId}
            active="accommodations"
            studentView={studentView}
          />
        </div>

        <div className="px-8 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-canvas-blueDark">
                <UserCog className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-wide">Accommodations</p>
              </div>
              <h2 className="mt-1 text-xl font-semibold text-canvas-grayDark">
                Course-wide quiz accommodations
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Extra time, multipliers, attempts, and availability unlocks for every quiz.
                Per-quiz grants on Moderate can add more on top. Changes stay in draft until
                you save.
              </p>
            </div>
            <div className="rounded-2xl border border-canvas-border/80 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                With grants
              </p>
              <p className="mt-1 text-lg font-semibold text-canvas-grayDark">
                {grantedCount}
                <span className="text-base font-normal text-gray-400"> / {students.length}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students by name or email…"
                className="form-input h-10 w-full pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportAccommodations}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => accommodationsFileRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Import JSON
              </button>
              <input
                ref={accommodationsFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void importAccommodationsFile(e.target.files?.[0] ?? null)}
              />
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={onlyWithGrants}
                  onChange={(e) => setOnlyWithGrants(e.target.checked)}
                  className="accent-canvas-blue"
                />
                Show only students with grants
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-canvas-border/80 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-canvas-grayDark">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                disabled={filteredIds.length === 0}
                onChange={toggleSelectAllFiltered}
                className="accent-canvas-blue"
              />
              {selectedTargetIds.length > 0
                ? `${selectedTargetIds.length} selected`
                : "Select students"}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedTargetIds.length === 0}
                onClick={() => bulkBumpMinutes(15)}
                className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +15 min selected
              </button>
              <button
                type="button"
                disabled={selectedTargetIds.length === 0}
                onClick={() => bulkBumpAttempts(1)}
                className="inline-flex h-8 items-center gap-0.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />1 attempt selected
              </button>
              <button
                type="button"
                disabled={selectedTargetIds.length === 0}
                onClick={bulkClear}
                className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear selected
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {students.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center xl:col-span-2 2xl:col-span-3">
                <Users className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-canvas-grayDark">
                  No students on the roster yet
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Add people from the Roster tab, then set accommodations here.
                </p>
                <Link to={peoplePath} className="btn-canvas-secondary mt-4 inline-flex text-sm">
                  Open Roster
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center xl:col-span-2 2xl:col-span-3">
                <p className="text-sm font-medium text-canvas-grayDark">No matching students</p>
                <p className="mt-1 text-sm text-gray-500">
                  Try a different search or clear the grants filter.
                </p>
              </div>
            ) : (
              filtered.map((member) => {
                const draft = drafts[member.id] ?? EMPTY_DRAFT;
                const rowDirty = dirtyStudentIds.includes(member.id);
                const hasGrant = draftHasGrant(draft);
                const saved = getQuizAccommodation(effectiveCourseId, member.id, null);
                const updatedLabel = formatUpdatedAt(saved?.updatedAt);
                const selected = selectedIds.has(member.id);
                const summary = formatAccommodationGrantParts({
                  extraMinutes: parseExtra(draft.extraMinutes) ?? 0,
                  extraAttempts: parseExtra(draft.extraAttempts) ?? 0,
                  timeMultiplier: parseMultiplier(draft.timeMultiplier) ?? 1,
                  unlockAvailability: draft.unlockAvailability,
                });

                return (
                  <div
                    key={member.id}
                    className={[
                      "flex h-full flex-col rounded-2xl border bg-white px-4 py-4 shadow-sm transition-colors",
                      rowDirty
                        ? "border-canvas-blue/40 ring-1 ring-canvas-blue/15"
                        : selected
                          ? "border-canvas-blue/30"
                          : "border-canvas-border/80",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(member.id)}
                        className="mt-3 accent-canvas-blue"
                        aria-label={`Select ${member.name}`}
                      />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-sm font-semibold text-canvas-blueDark">
                        {initialsFromName(member.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-canvas-grayDark">
                            {member.name}
                          </p>
                          {rowDirty && (
                            <span className="rounded-full bg-canvas-blueTint px-2 py-0.5 text-[11px] font-medium text-canvas-blueDark">
                              Unsaved
                            </span>
                          )}
                          {hasGrant && !rowDirty && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Active grant
                            </span>
                          )}
                        </div>
                        {member.email && (
                          <p className="truncate text-xs text-gray-500">{member.email}</p>
                        )}
                        {hasGrant && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            {summary}
                            {updatedLabel ? ` · Last saved ${updatedLabel}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          Extra minutes
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={draft.extraMinutes}
                            onChange={(e) =>
                              updateDraft(member.id, { extraMinutes: e.target.value })
                            }
                            placeholder="0"
                            className="form-input h-9 min-w-0 flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => bumpMinutes(member.id, 15)}
                            className="h-9 shrink-0 rounded-md border border-gray-300 px-2 text-xs font-medium text-canvas-blue hover:bg-gray-50"
                          >
                            +15
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Extra attempts
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={draft.extraAttempts}
                            onChange={(e) =>
                              updateDraft(member.id, { extraAttempts: e.target.value })
                            }
                            placeholder="0"
                            className="form-input h-9 min-w-0 flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => bumpAttempts(member.id, 1)}
                            className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-md border border-gray-300 px-2 text-xs font-medium text-canvas-blue hover:bg-gray-50"
                          >
                            <Plus className="h-3.5 w-3.5" />1
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Time multiplier
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={0.25}
                          value={draft.timeMultiplier}
                          onChange={(e) =>
                            updateDraft(member.id, { timeMultiplier: e.target.value })
                          }
                          placeholder="1"
                          className="form-input h-9 w-full"
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={draft.unlockAvailability}
                            onChange={(e) =>
                              updateDraft(member.id, {
                                unlockAvailability: e.target.checked,
                              })
                            }
                            className="accent-canvas-blue"
                          />
                          Unlock availability
                        </label>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                      {ACCOMMODATION_TIME_EXPLAINER}
                    </p>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Note
                      </label>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) => updateDraft(member.id, { note: e.target.value })}
                        placeholder="Reason for this grant (optional)"
                        className="form-input h-9 w-full text-sm"
                      />
                    </div>

                    {hasGrant && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => clearStudentDraft(member.id)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-canvas-red"
                        >
                          Clear grants
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-canvas-border bg-white/95 px-8 py-4 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {isDirty ? (
              <>
                <span className="font-medium text-canvas-grayDark">
                  {dirtyStudentIds.length} unsaved change
                  {dirtyStudentIds.length === 1 ? "" : "s"}
                </span>
                <span className="text-gray-400"> · </span>
                Save to apply course-wide
              </>
            ) : (
              "No unsaved changes"
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!isDirty}
              className="btn-canvas-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={!isDirty}
              className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      {leaveGuardModal}
    </div>
  );
}
