import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CanvasModal from "../components/CanvasModal";
import CourseHeader from "../components/CourseHeader";
import CoursePublishControl from "../components/CoursePublishControl";
import LatePenaltyPolicySelect from "../components/LatePenaltyPolicySelect";
import PageIdentityHeader from "../components/PageIdentityHeader";
import { useToast } from "../components/ui/Toast";
import { useLiveCourse } from "../hooks/useLiveCourse";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import type { AssignmentSubmissionType } from "../utils/assignments";
import {
  archiveCourse,
  COURSE_COLORS,
  createAssignmentGroupId,
  deleteCourse,
  getCourseAssignmentDefaults,
  getCourseAssignmentGroups,
  normalizeAssignmentGroups,
  reassignItemsToValidGroups,
  updateCourse,
  type AssignmentGroup,
} from "../utils/coursesStore";
import {
  downloadCoursePackage,
  importCoursePackage,
  parseCoursePackage,
  DEFAULT_IMPORT_SECTIONS,
  type CoursePackage,
  type CoursePackageImportSections,
} from "../utils/coursePackage";
import {
  STUDENT_COURSE_NAV_ITEMS,
  computeStudentNavHiddenAfterToggle,
  getStudentHiddenNavItems,
  type CourseNavItemId,
} from "../utils/courseNavigation";
import {
  createCustomLatePenaltyPresetId,
  describeLatePenaltyPreset,
  isIntervalPenaltyType,
  migrateLegacyCustomPreset,
  normalizeCustomLatePenaltyPreset,
  toLatePenaltyPreset,
  type CourseCustomLatePenaltyPreset,
} from "../utils/courseLatePenalty";
import {
  DEFAULT_LATE_PENALTY_PRESET_ID,
  getDefaultLatePenaltyPresets,
  LATE_PENALTY_TIME_UNITS,
  type LatePenaltyTimeUnit,
} from "../utils/latePenalty";
import {
  DEFAULT_GRADING_BANDS,
  getDefaultGradingScheme,
  getGradingScheme,
  normalizeGradingBands,
  type LetterGradeBand,
} from "../utils/gradingScheme";

export default function CourseSettingsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { setStudentView } = useStudentView(effectiveCourseId);
  const { canManageCourse } = usePermissions();
  const { showToast } = useToast();
  const course = useLiveCourse(effectiveCourseId);
  const defaults = getCourseAssignmentDefaults(course);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingReplacePkg, setPendingReplacePkg] = useState<CoursePackage | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    pkg: CoursePackage;
    mode: "new" | "replace";
  } | null>(null);
  const [importSections, setImportSections] = useState<CoursePackageImportSections>({
    ...DEFAULT_IMPORT_SECTIONS,
  });

  const [title, setTitle] = useState(course?.title ?? "");
  const [code, setCode] = useState(course?.code ?? "");
  const [shortName, setShortName] = useState(course?.short_name ?? "");
  const [term, setTerm] = useState(course?.term ?? "");
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0]!);
  const [monacoCodeEditor, setMonacoCodeEditor] = useState(
    course?.monacoCodeEditor ?? false,
  );
  const [treatUngradedAsZero, setTreatUngradedAsZero] = useState(
    course?.treatUngradedAsZero ?? false,
  );
  const [weightedGrading, setWeightedGrading] = useState(
    course?.weightedGrading !== false,
  );
  const [hideTotalsUntilPosted, setHideTotalsUntilPosted] = useState(
    course?.hideTotalsUntilPosted ?? false,
  );
  const [showGroupSubtotals, setShowGroupSubtotals] = useState(
    course?.showGroupSubtotals !== false,
  );
  const [defaultSubmissionType, setDefaultSubmissionType] = useState<AssignmentSubmissionType>(
    defaults.submissionType,
  );
  const [defaultAllowLate, setDefaultAllowLate] = useState(defaults.allowLateSubmissions);
  const [defaultAllowResubmit, setDefaultAllowResubmit] = useState(defaults.allowResubmissions);
  const [defaultLatePenaltyPresetId, setDefaultLatePenaltyPresetId] = useState(
    defaults.latePenaltyPresetId,
  );
  const [customLatePenaltyPresets, setCustomLatePenaltyPresets] = useState<
    CourseCustomLatePenaltyPreset[]
  >(course?.customLatePenaltyPresets ?? []);
  const [studentNavHidden, setStudentNavHidden] = useState<CourseNavItemId[]>(
    () => getStudentHiddenNavItems(course),
  );
  const savedGradingScheme = getGradingScheme(effectiveCourseId);
  const [showLetterGrades, setShowLetterGrades] = useState(savedGradingScheme.showLetterGrades);
  const [showOverallPercent, setShowOverallPercent] = useState(savedGradingScheme.showOverallPercent);
  const [gradingBands, setGradingBands] = useState<LetterGradeBand[]>(savedGradingScheme.bands);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>(
    () => getCourseAssignmentGroups(course).map((g) => ({ ...g })),
  );
  const [draftRule, setDraftRule] = useState<CourseCustomLatePenaltyPreset>(() => ({
    id: createCustomLatePenaltyPresetId(),
    label: "",
    type: "percent_per_unit",
    unit: "hours",
    value: 10,
    maxPercent: 50,
  }));

  const customPolicyPresets = customLatePenaltyPresets.map(toLatePenaltyPreset);

  useEffect(() => {
    if (!canManageCourse) {
      navigate(`/courses/${effectiveCourseId}`, { replace: true });
    }
  }, [canManageCourse, navigate, effectiveCourseId]);

  useEffect(() => {
    if (!course) return;
    const nextDefaults = getCourseAssignmentDefaults(course);
    setTitle(course.title);
    setCode(course.code);
    setShortName(course.short_name);
    setTerm(course.term);
    setColor(course.color);
    setMonacoCodeEditor(course.monacoCodeEditor ?? false);
    setTreatUngradedAsZero(course.treatUngradedAsZero ?? false);
    setWeightedGrading(course.weightedGrading !== false);
    setHideTotalsUntilPosted(course.hideTotalsUntilPosted ?? false);
    setShowGroupSubtotals(course.showGroupSubtotals !== false);
    setDefaultSubmissionType(nextDefaults.submissionType);
    setDefaultAllowLate(nextDefaults.allowLateSubmissions);
    setDefaultAllowResubmit(nextDefaults.allowResubmissions);
    setDefaultLatePenaltyPresetId(nextDefaults.latePenaltyPresetId);
    setCustomLatePenaltyPresets(
      (course.customLatePenaltyPresets ?? [])
        .map((rule) => migrateLegacyCustomPreset(rule))
        .map((rule) => normalizeCustomLatePenaltyPreset(rule))
        .filter((rule): rule is CourseCustomLatePenaltyPreset => rule != null),
    );
    setStudentNavHidden(getStudentHiddenNavItems(course));
    const scheme = getGradingScheme(course.id);
    setShowLetterGrades(scheme.showLetterGrades);
    setShowOverallPercent(scheme.showOverallPercent);
    setGradingBands(scheme.bands);
    setAssignmentGroups(getCourseAssignmentGroups(course).map((g) => ({ ...g })));
  }, [course?.id, course?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasUnsavedChanges = useMemo(() => {
    if (!course) return false;
    const savedDefaults = getCourseAssignmentDefaults(course);
    const savedCustomRules = (course.customLatePenaltyPresets ?? [])
      .map((rule) => migrateLegacyCustomPreset(rule))
      .map((rule) => normalizeCustomLatePenaltyPreset(rule))
      .filter((rule): rule is CourseCustomLatePenaltyPreset => rule != null);
    const currentCustomRules = customLatePenaltyPresets
      .map((rule) => normalizeCustomLatePenaltyPreset(rule))
      .filter((rule): rule is CourseCustomLatePenaltyPreset => rule != null);
    const savedScheme = getGradingScheme(course.id);
    const normalizedBands = normalizeGradingBands(gradingBands);
    const savedGroups = getCourseAssignmentGroups(course);

    return (
      title.trim() !== course.title ||
      code.trim() !== course.code ||
      (shortName.trim() || code.trim()) !== course.short_name ||
      term.trim() !== course.term ||
      color !== course.color ||
      Boolean(monacoCodeEditor) !== Boolean(course.monacoCodeEditor) ||
      Boolean(treatUngradedAsZero) !== Boolean(course.treatUngradedAsZero) ||
      weightedGrading !== (course.weightedGrading !== false) ||
      Boolean(hideTotalsUntilPosted) !== Boolean(course.hideTotalsUntilPosted) ||
      showGroupSubtotals !== (course.showGroupSubtotals !== false) ||
      defaultSubmissionType !== savedDefaults.submissionType ||
      defaultAllowLate !== savedDefaults.allowLateSubmissions ||
      defaultAllowResubmit !== savedDefaults.allowResubmissions ||
      defaultLatePenaltyPresetId !== savedDefaults.latePenaltyPresetId ||
      JSON.stringify(currentCustomRules) !== JSON.stringify(savedCustomRules) ||
      JSON.stringify([...studentNavHidden].sort()) !==
        JSON.stringify([...getStudentHiddenNavItems(course)].sort()) ||
      showLetterGrades !== savedScheme.showLetterGrades ||
      showOverallPercent !== savedScheme.showOverallPercent ||
      JSON.stringify(normalizedBands) !== JSON.stringify(normalizeGradingBands(savedScheme.bands)) ||
      JSON.stringify(assignmentGroups) !== JSON.stringify(savedGroups)
    );
  }, [
    course,
    title,
    code,
    shortName,
    term,
    color,
    monacoCodeEditor,
    treatUngradedAsZero,
    weightedGrading,
    hideTotalsUntilPosted,
    showGroupSubtotals,
    defaultSubmissionType,
    defaultAllowLate,
    defaultAllowResubmit,
    defaultLatePenaltyPresetId,
    customLatePenaltyPresets,
    studentNavHidden,
    showLetterGrades,
    showOverallPercent,
    gradingBands,
    assignmentGroups,
  ]);

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

  const handleSave = () => {
    if (!title.trim() || !code.trim()) {
      showToast("Title and code are required", "negative");
      return;
    }
    if (studentNavHidden.length >= STUDENT_COURSE_NAV_ITEMS.length) {
      showToast("At least one navigation item must be visible to students", "negative");
      return;
    }
    const normalizedCustomRules = customLatePenaltyPresets
      .map((rule) => normalizeCustomLatePenaltyPreset(rule))
      .filter((rule): rule is CourseCustomLatePenaltyPreset => rule != null);
    const presetIds = new Set([
      ...getDefaultLatePenaltyPresets().map((preset) => preset.id),
      ...normalizedCustomRules.map((rule) => rule.id),
    ]);
    const nextDefaultPreset = presetIds.has(defaultLatePenaltyPresetId)
      ? defaultLatePenaltyPresetId
      : DEFAULT_LATE_PENALTY_PRESET_ID;
    const normalizedBands = normalizeGradingBands(gradingBands);
    if (normalizedBands.length === 0) {
      showToast("Add at least one letter grade band", "negative");
      return;
    }
    const cleanedGroups = normalizeAssignmentGroups(
      assignmentGroups.map((g) => ({
        ...g,
        weight: Number.isFinite(g.weight) ? Math.max(0, g.weight) : 0,
        dropLowest:
          typeof g.dropLowest === "number" && g.dropLowest > 0
            ? Math.floor(g.dropLowest)
            : undefined,
        dropHighest:
          typeof g.dropHighest === "number" && g.dropHighest > 0
            ? Math.floor(g.dropHighest)
            : undefined,
        extraCredit: g.extraCredit || undefined,
        neverDropIds: g.neverDropIds?.length ? g.neverDropIds : undefined,
      })),
    );
    if (cleanedGroups.length === 0) {
      showToast("Add at least one assignment group", "negative");
      return;
    }
    const validIds = new Set(cleanedGroups.map((g) => g.id));
    reassignItemsToValidGroups(course.id, validIds);
    updateCourse(course.id, {
      title: title.trim(),
      code: code.trim(),
      short_name: shortName.trim() || code.trim(),
      term: term.trim(),
      color,
      monacoCodeEditor,
      treatUngradedAsZero,
      weightedGrading,
      hideTotalsUntilPosted,
      showGroupSubtotals,
      defaultSubmissionType,
      defaultAllowLateSubmissions: defaultAllowLate,
      defaultAllowResubmissions: defaultAllowResubmit,
      defaultLatePenaltyPresetId: nextDefaultPreset,
      customLatePenaltyPresets: normalizedCustomRules,
      studentNavHidden,
      gradingScheme: {
        showLetterGrades,
        showOverallPercent,
        bands: normalizedBands,
      },
      assignmentGroups: cleanedGroups,
    });
    if (nextDefaultPreset !== defaultLatePenaltyPresetId) {
      setDefaultLatePenaltyPresetId(nextDefaultPreset);
    }
    setCustomLatePenaltyPresets(normalizedCustomRules);
    setGradingBands(normalizedBands);
    setAssignmentGroups(cleanedGroups);
    showToast("Course settings saved", "positive", "saved");
  };

  const updateBand = (index: number, patch: Partial<LetterGradeBand>) => {
    setGradingBands((bands) =>
      bands.map((band, i) => (i === index ? { ...band, ...patch } : band)),
    );
  };

  const removeBand = (index: number) => {
    setGradingBands((bands) => bands.filter((_, i) => i !== index));
  };

  const addBand = () => {
    setGradingBands((bands) => [...bands, { letter: "", minPercent: 0 }]);
  };

  const resetGradingBands = () => {
    const defaults = getDefaultGradingScheme();
    setGradingBands([...DEFAULT_GRADING_BANDS]);
    setShowLetterGrades(defaults.showLetterGrades);
    setShowOverallPercent(defaults.showOverallPercent);
  };

  const updateAssignmentGroup = (id: string, patch: Partial<AssignmentGroup>) => {
    setAssignmentGroups((groups) =>
      groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
  };

  const removeAssignmentGroup = (id: string) => {
    setAssignmentGroups((groups) => {
      if (groups.length <= 1) return groups;
      return groups.filter((g) => g.id !== id);
    });
  };

  const addAssignmentGroup = () => {
    setAssignmentGroups((groups) => [
      ...groups,
      { id: createAssignmentGroupId(), name: "New group", weight: 0 },
    ]);
  };

  const moveAssignmentGroup = (index: number, direction: -1 | 1) => {
    setAssignmentGroups((groups) => {
      const next = [...groups];
      const target = index + direction;
      if (target < 0 || target >= next.length) return groups;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  };

  const assignmentGroupsWeightTotal = assignmentGroups.reduce(
    (sum, g) =>
      g.extraCredit ? sum : sum + (Number.isFinite(g.weight) ? g.weight : 0),
    0,
  );
  const assignmentGroupsExtraCreditWeight = assignmentGroups.reduce(
    (sum, g) =>
      g.extraCredit ? sum + (Number.isFinite(g.weight) ? g.weight : 0) : sum,
    0,
  );

  const updateCustomRule = (
    id: string,
    patch: Partial<CourseCustomLatePenaltyPreset>,
  ) => {
    setCustomLatePenaltyPresets((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  };

  const removeCustomRule = (id: string) => {
    setCustomLatePenaltyPresets((rules) => rules.filter((rule) => rule.id !== id));
    if (defaultLatePenaltyPresetId === id) {
      setDefaultLatePenaltyPresetId(DEFAULT_LATE_PENALTY_PRESET_ID);
    }
  };

  const addCustomRule = () => {
    const normalized = normalizeCustomLatePenaltyPreset(draftRule);
    if (!normalized) {
      showToast("Enter a rule name and valid penalty value", "negative");
      return;
    }
    setCustomLatePenaltyPresets((rules) => [...rules, normalized]);
    setDraftRule({
      id: createCustomLatePenaltyPresetId(),
      label: "",
      type: "percent_per_unit",
      unit: "hours",
      value: 10,
      maxPercent: 50,
    });
  };

  const toggleStudentNavVisibility = (id: CourseNavItemId) => {
    const visible = !studentNavHidden.includes(id);
    const next = computeStudentNavHiddenAfterToggle(studentNavHidden, id, !visible);
    if (!next) {
      showToast("At least one navigation item must be visible to students", "negative");
      return;
    }
    setStudentNavHidden(next);
  };

  const visibleNavCount = useMemo(
    () => STUDENT_COURSE_NAV_ITEMS.length - studentNavHidden.length,
    [studentNavHidden],
  );

  const handlePreviewAsStudent = () => {
    setStudentView(true);
    navigate(`/courses/${effectiveCourseId}/home`);
  };

  const handleArchive = () => {
    archiveCourse(course.id);
    showToast("Course archived", "positive", "saved");
    navigate("/", { replace: true });
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    deleteCourse(course.id);
    showToast("Course deleted", "positive", "deleted");
    navigate("/", { replace: true });
  };

  const handleExportPackage = () => {
    if (!downloadCoursePackage(course.id)) {
      showToast("Could not export course package", "negative");
      return;
    }
    showToast("Course package downloaded", "positive", "files");
  };

  const handleImportFile = async (file: File, mode: "new" | "replace") => {
    try {
      const text = await file.text();
      const pkg = parseCoursePackage(JSON.parse(text));
      if (!pkg) {
        showToast("Invalid course package file", "negative");
        return;
      }
      if (mode === "replace" && pkg.course.id !== course.id) {
        showToast(
          `Replace requires a package for this course (id ${course.id}). Use Import as new course instead.`,
          "negative",
        );
        return;
      }
      setImportSections({ ...DEFAULT_IMPORT_SECTIONS });
      setPendingImport({ pkg, mode });
    } catch {
      showToast("Could not read course package", "negative");
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const { pkg, mode } = pendingImport;
    if (mode === "replace") {
      setPendingImport(null);
      setPendingReplacePkg(pkg);
      return;
    }
    const newId = importCoursePackage(pkg, { mode: "new", sections: importSections });
    setPendingImport(null);
    if (!newId) {
      showToast("Import failed", "negative");
      return;
    }
    showToast("Course imported", "positive", "files");
    navigate(`/courses/${newId}/settings`);
  };

  const confirmReplace = () => {
    if (!pendingReplacePkg) return;
    const id = importCoursePackage(pendingReplacePkg, {
      mode: "replace",
      sections: importSections,
    });
    setPendingReplacePkg(null);
    if (!id) {
      showToast("Replace failed", "negative");
      return;
    }
    showToast("Course package restored", "positive", "files");
    window.location.reload();
  };

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8 text-canvas-grayDark">
        <div className="w-full">
          <PageIdentityHeader
            size="md"
            icon="settings"
            label="Settings"
            title="Course Settings"
            description="Manage course details, defaults, and visibility."
          />

          <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Visibility</h2>
            <p className="mb-4 text-sm text-gray-600">
              Control whether students can access this course and what they see in the course menu.
            </p>

            <div
              className={`rounded-lg border p-4 ${
                course.published
                  ? "border-green-200 bg-green-50/60"
                  : "border-amber-200 bg-amber-50/60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        course.published
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {course.published ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Circle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {course.published ? "Published" : "Draft — hidden from students"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    {course.published
                      ? "Students enrolled in this course can find it on their dashboard and open published assignments, quizzes, and pages."
                      : "Only instructors can see this course. Students will not find it on their dashboard until you publish it."}
                  </p>
                </div>
                <CoursePublishControl courseId={effectiveCourseId} variant="settings" />
              </div>
            </div>

            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>
                Publishing the course does not automatically publish individual assignments,
                quizzes, or pages.
              </li>
              <li>
                {visibleNavCount} of {STUDENT_COURSE_NAV_ITEMS.length} course navigation items are
                visible to students.
              </li>
              <li>Course publish status updates immediately across the app.</li>
            </ul>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePreviewAsStudent}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Eye className="h-4 w-4" aria-hidden />
                Preview as student
              </button>
              <a
                href="#course-navigation"
                className="inline-flex items-center text-sm font-medium text-canvas-blue hover:underline"
              >
                Configure course navigation →
              </a>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Course details</h2>
            <p className="mb-4 text-sm text-gray-600">Basic information shown across the course.</p>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Course title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full form-input"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">Course code</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 w-full form-input"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">Short name</span>
                  <input
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="mt-1 w-full form-input"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Term</span>
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="mt-1 w-full form-input"
                />
              </label>
              <div>
                <span className="text-sm font-medium text-gray-700">Course color</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COURSE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${
                        color === c ? "ring-canvas-blue" : "ring-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={monacoCodeEditor}
                  onChange={(e) => setMonacoCodeEditor(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                />
                <span>
                  <span className="font-medium text-gray-700">
                    Monaco code editor for quiz coding questions
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Applies to every quiz in this course. Individual quizzes can still override
                    this in quiz settings.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Assignment defaults</h2>
            <p className="mb-4 text-sm text-gray-600">
              Applied when creating new assignments. Existing assignments are not changed.
            </p>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Default submission type</span>
                <select
                  value={defaultSubmissionType}
                  onChange={(e) =>
                    setDefaultSubmissionType(e.target.value as AssignmentSubmissionType)
                  }
                  className="mt-1 w-full form-input bg-arc-paper"
                >
                  <option value="online_text">Online text entry</option>
                  <option value="online_upload">File upload</option>
                  <option value="online_text_upload">Online text entry and file upload</option>
                  <option value="none">No submission (on paper)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={defaultAllowLate}
                  onChange={(e) => setDefaultAllowLate(e.target.checked)}
                  className="rounded border-gray-300 text-canvas-blue"
                />
                <span className="text-gray-700">Allow late submissions by default</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={defaultAllowResubmit}
                  onChange={(e) => setDefaultAllowResubmit(e.target.checked)}
                  className="rounded border-gray-300 text-canvas-blue"
                />
                <span className="text-gray-700">Allow resubmissions by default</span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Default late penalty policy</span>
                <LatePenaltyPolicySelect
                  value={defaultLatePenaltyPresetId}
                  onChange={setDefaultLatePenaltyPresetId}
                  customPresets={customPolicyPresets}
                  className="mt-1 w-full form-input bg-arc-paper"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used in GradePro when a late submission is graded.
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Grading</h2>
            <p className="mb-4 text-sm text-gray-600">
              Configure how assignments, quizzes, and discussions contribute to the course
              grade, plus what students can see.
            </p>
            <div className="space-y-4">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={weightedGrading}
                  onChange={(e) => setWeightedGrading(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                />
                <span>
                  <span className="text-gray-700">Weighted grading</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    When enabled, overall % is a weighted average of each assignment group. When
                    off, overall % is total points earned ÷ total points possible.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={treatUngradedAsZero}
                  onChange={(e) => setTreatUngradedAsZero(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                />
                <span>
                  <span className="text-gray-700">Treat ungraded items as 0</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Student current grade includes unpublished/ungraded work as zeros instead of
                    omitting them.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideTotalsUntilPosted}
                  onChange={(e) => setHideTotalsUntilPosted(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                />
                <span>
                  <span className="text-gray-700">Hide totals until grades are posted</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Students do not see overall percentage or letter until you post grades.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showGroupSubtotals}
                  onChange={(e) => setShowGroupSubtotals(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                />
                <span>
                  <span className="text-gray-700">Show group subtotals in the gradebook</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Display each assignment group&apos;s percentage alongside the overall grade.
                  </span>
                </span>
              </label>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700">Assignment groups</span>
                  {weightedGrading && (
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        assignmentGroupsWeightTotal === 100
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-800",
                      ].join(" ")}
                    >
                      Weights total {assignmentGroupsWeightTotal}%
                      {assignmentGroupsExtraCreditWeight > 0
                        ? ` + ${assignmentGroupsExtraCreditWeight}% extra credit`
                        : ""}
                      {assignmentGroupsWeightTotal !== 100
                        ? " · normalized in grades"
                        : ""}
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  Create groups that match your grading policy (Homework, Exams, Labs, and so on).
                  Assignments, quizzes, and discussions each pick a group in their editor.
                  Extra-credit groups add on top of the final grade and are never used to normalize
                  other group weights.
                </p>

                <div className="w-max max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-arc-paper">
                  <div
                    className={[
                      "hidden items-center gap-x-5 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid",
                      weightedGrading
                        ? "grid-cols-[2.25rem_14rem_7.5rem_15rem_8.5rem_2.5rem]"
                        : "grid-cols-[2.25rem_14rem_15rem_8.5rem_2.5rem]",
                    ].join(" ")}
                  >
                    <span aria-hidden="true" />
                    <span className="pl-16">Name</span>
                    {weightedGrading && <span className="text-center">Weight</span>}
                    <span className="pl-16">Drop scores</span>
                    <span>Extra credit</span>
                    <span aria-hidden="true" />
                  </div>

                  <div className="divide-y divide-gray-100">
                    {assignmentGroups.map((group, index) => (
                      <div
                        key={group.id}
                        className={[
                          "grid items-center gap-x-5 gap-y-2 px-4 py-3",
                          weightedGrading
                            ? "grid-cols-1 sm:grid-cols-[2.25rem_14rem_7.5rem_15rem_8.5rem_2.5rem]"
                            : "grid-cols-1 sm:grid-cols-[2.25rem_14rem_15rem_8.5rem_2.5rem]",
                        ].join(" ")}
                      >
                        <div className="flex shrink-0 flex-row gap-0.5 sm:flex-col">
                          <button
                            type="button"
                            onClick={() => moveAssignmentGroup(index, -1)}
                            disabled={index === 0}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                            aria-label="Move group up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAssignmentGroup(index, 1)}
                            disabled={index === assignmentGroups.length - 1}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                            aria-label="Move group down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <input
                          value={group.name}
                          onChange={(e) =>
                            updateAssignmentGroup(group.id, { name: e.target.value })
                          }
                          placeholder="Group name"
                          className="form-input w-full text-sm"
                          aria-label="Assignment group name"
                        />

                        {weightedGrading && (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={group.weight}
                              onChange={(e) =>
                                updateAssignmentGroup(group.id, {
                                  weight: Number(e.target.value),
                                })
                              }
                              className="form-input w-[4.75rem] px-2 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              aria-label={`${group.name || "Group"} weight`}
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span className="text-gray-500">Lowest</span>
                          <input
                            type="number"
                            min={0}
                            value={group.dropLowest ?? 0}
                            onChange={(e) =>
                              updateAssignmentGroup(group.id, {
                                dropLowest: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="form-input w-14 py-1 text-center text-xs"
                            aria-label="Drop lowest scores"
                          />
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">Highest</span>
                          <input
                            type="number"
                            min={0}
                            value={group.dropHighest ?? 0}
                            onChange={(e) =>
                              updateAssignmentGroup(group.id, {
                                dropHighest: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="form-input w-14 py-1 text-center text-xs"
                            aria-label="Drop highest scores"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={Boolean(group.extraCredit)}
                            onChange={(e) =>
                              updateAssignmentGroup(group.id, {
                                extraCredit: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300 text-canvas-blue"
                          />
                          Extra credit
                        </label>

                        <button
                          type="button"
                          onClick={() => removeAssignmentGroup(group.id)}
                          className="justify-self-end rounded-md p-1.5 text-canvas-red hover:bg-red-50 disabled:opacity-30"
                          disabled={assignmentGroups.length <= 1}
                          aria-label={`Remove ${group.name || "group"}`}
                          title="Remove group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addAssignmentGroup}
                  className="btn-canvas-secondary mt-3 inline-flex items-center gap-1.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add group
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOverallPercent}
                  onChange={(e) => setShowOverallPercent(e.target.checked)}
                  className="rounded border-gray-300 text-canvas-blue"
                />
                <span className="text-gray-700">Show overall percentage to students</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showLetterGrades}
                  onChange={(e) => setShowLetterGrades(e.target.checked)}
                  className="rounded border-gray-300 text-canvas-blue"
                />
                <span className="text-gray-700">Show letter grades to students</span>
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Letter grade bands</span>
                  <button
                    type="button"
                    onClick={resetGradingBands}
                    className="text-xs text-canvas-blue hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  Bands are evaluated from highest minimum percent downward.
                </p>
                <div className="space-y-2">
                  {gradingBands.map((band, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={band.letter}
                        onChange={(e) => updateBand(index, { letter: e.target.value })}
                        placeholder="Letter"
                        className="w-20 form-input text-sm"
                      />
                      <span className="text-sm text-gray-500">≥</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={band.minPercent}
                        onChange={(e) =>
                          updateBand(index, { minPercent: Number(e.target.value) })
                        }
                        className="w-24 form-input text-sm"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <button
                        type="button"
                        onClick={() => removeBand(index)}
                        className="rounded px-2 py-1 text-xs text-canvas-red hover:bg-red-50"
                        disabled={gradingBands.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addBand}
                  className="mt-3 text-sm text-canvas-blue hover:underline"
                >
                  + Add band
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Custom late penalty rules</h2>
            <p className="mb-4 text-sm text-gray-600">
              Create course-specific penalty policies. They appear alongside built-in presets in
              GradePro and in the default policy dropdown above.
            </p>

            {customLatePenaltyPresets.length > 0 && (
              <div className="mb-4 space-y-3">
                {customLatePenaltyPresets.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-lg border border-canvas-border bg-gray-50 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm sm:col-span-2">
                        <span className="font-medium text-gray-700">Rule name</span>
                        <input
                          value={rule.label}
                          onChange={(e) => updateCustomRule(rule.id, { label: e.target.value })}
                          className="mt-1 w-full form-input"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-gray-700">Penalty type</span>
                        <select
                          value={rule.type}
                          onChange={(e) =>
                            updateCustomRule(rule.id, {
                              type: e.target.value as CourseCustomLatePenaltyPreset["type"],
                            })
                          }
                          className="mt-1 w-full form-input bg-arc-paper"
                        >
                          <option value="percent_per_unit">Percent per interval</option>
                          <option value="points_per_unit">Points per interval</option>
                          <option value="percent_flat">Percent flat</option>
                          <option value="points_flat">Points flat</option>
                        </select>
                      </label>
                      {isIntervalPenaltyType(rule.type) && (
                        <label className="block text-sm">
                          <span className="font-medium text-gray-700">Time unit</span>
                          <select
                            value={rule.unit}
                            onChange={(e) =>
                              updateCustomRule(rule.id, {
                                unit: e.target.value as LatePenaltyTimeUnit,
                              })
                            }
                            className="mt-1 w-full form-input bg-arc-paper"
                          >
                            {LATE_PENALTY_TIME_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit.charAt(0).toUpperCase() + unit.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="block text-sm">
                        <span className="font-medium text-gray-700">Value</span>
                        <input
                          type="number"
                          min={0}
                          value={rule.value}
                          onChange={(e) =>
                            updateCustomRule(rule.id, { value: Number(e.target.value) })
                          }
                          className="mt-1 w-full form-input"
                        />
                      </label>
                      {rule.type === "percent_per_unit" && (
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium text-gray-700">Maximum percent (optional)</span>
                          <input
                            type="number"
                            min={0}
                            value={rule.maxPercent ?? ""}
                            onChange={(e) =>
                              updateCustomRule(rule.id, {
                                maxPercent:
                                  e.target.value === "" ? undefined : Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full form-input"
                          />
                        </label>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {describeLatePenaltyPreset(rule)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeCustomRule(rule.id)}
                      className="mt-3 text-sm text-red-600 hover:underline"
                    >
                      Remove rule
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-dashed border-gray-300 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700">Add custom rule</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-gray-700">Rule name</span>
                  <input
                    value={draftRule.label}
                    onChange={(e) => setDraftRule({ ...draftRule, label: e.target.value })}
                    placeholder="e.g. 5 points per hour"
                    className="mt-1 w-full form-input"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">Penalty type</span>
                  <select
                    value={draftRule.type}
                    onChange={(e) =>
                      setDraftRule({
                        ...draftRule,
                        type: e.target.value as CourseCustomLatePenaltyPreset["type"],
                      })
                    }
                    className="mt-1 w-full form-input bg-arc-paper"
                  >
                    <option value="percent_per_unit">Percent per interval</option>
                    <option value="points_per_unit">Points per interval</option>
                    <option value="percent_flat">Percent flat</option>
                    <option value="points_flat">Points flat</option>
                  </select>
                </label>
                {isIntervalPenaltyType(draftRule.type) && (
                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">Time unit</span>
                    <select
                      value={draftRule.unit}
                      onChange={(e) =>
                        setDraftRule({
                          ...draftRule,
                          unit: e.target.value as LatePenaltyTimeUnit,
                        })
                      }
                      className="mt-1 w-full form-input bg-arc-paper"
                    >
                      {LATE_PENALTY_TIME_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">Value</span>
                  <input
                    type="number"
                    min={0}
                    value={draftRule.value}
                    onChange={(e) =>
                      setDraftRule({ ...draftRule, value: Number(e.target.value) })
                    }
                    className="mt-1 w-full form-input"
                  />
                </label>
                {draftRule.type === "percent_per_unit" && (
                  <label className="block text-sm sm:col-span-2">
                    <span className="font-medium text-gray-700">Maximum percent (optional)</span>
                    <input
                      type="number"
                      min={0}
                      value={draftRule.maxPercent ?? ""}
                      onChange={(e) =>
                        setDraftRule({
                          ...draftRule,
                          maxPercent:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full form-input"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={addCustomRule}
                className="mt-4 text-sm font-medium text-canvas-blue hover:underline"
              >
                Add rule
              </button>
            </div>
          </section>

          <section
            id="course-navigation"
            className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm scroll-mt-8"
          >
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Course navigation</h2>
            <p className="mb-4 text-sm text-gray-600">
              Choose which sidebar list pages students can see. Individual pages, assignments, files,
              and other items linked from modules remain accessible.
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {STUDENT_COURSE_NAV_ITEMS.map(({ id, label }) => {
                const visible = !studentNavHidden.includes(id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className={`truncate ${visible ? "text-gray-700" : "text-gray-400"}`}>
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleStudentNavVisibility(id)}
                      className={`ml-2 shrink-0 rounded p-1 ${
                        visible
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-gray-400 hover:bg-gray-100 hover:text-canvas-blue"
                      }`}
                      title={visible ? "Visible to students" : "Hidden from students"}
                      aria-label={
                        visible ? `Hide ${label} from students` : `Show ${label} to students`
                      }
                    >
                      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-arc-paper p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">
              Import / export package
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Download a JSON package of this course (curriculum, roster, student activity, question
              banks, peer reviews, accommodations, rubric templates, group spaces, attendance,
              collaborations, and course inbox). File binaries are not
              included. Choose which sections to import as a new course, or replace this course from
              a matching package.
            </p>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const mode = e.target.dataset.mode === "replace" ? "replace" : "new";
                void handleImportFile(file, mode);
              }}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportPackage}
                className="rounded-md border border-gray-300 bg-arc-paper px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
              >
                Export course package
              </button>
              <button
                type="button"
                onClick={() => {
                  if (importInputRef.current) {
                    importInputRef.current.dataset.mode = "new";
                    importInputRef.current.click();
                  }
                }}
                className="rounded-md bg-canvas-blue px-4 py-2 text-sm font-medium text-white hover:bg-canvas-blueDark"
              >
                Import as new course
              </button>
              <button
                type="button"
                onClick={() => {
                  if (importInputRef.current) {
                    importInputRef.current.dataset.mode = "replace";
                    importInputRef.current.click();
                  }
                }}
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                Replace this course…
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-red-200 bg-red-50/40 p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-red-800">Danger zone</h2>
            <p className="mb-4 text-sm text-red-700/80">
              Archive hides the course from your dashboard. Delete permanently removes all course
              data.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleArchive}
                className="rounded-md border border-red-300 bg-arc-paper px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Archive course
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete course
              </button>
            </div>
          </section>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
            <Link
              to={`/courses/${effectiveCourseId}`}
              className="btn-canvas-secondary"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save settings
            </button>
          </div>
        </div>
      </div>
      {pendingImport && (
        <CanvasModal
          title={
            pendingImport.mode === "replace"
              ? "Choose what to replace"
              : "Choose what to import"
          }
          onClose={() => setPendingImport(null)}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select the sections to include. Unchecked sections are left as they are.
            </p>
            <ul className="space-y-2 text-sm">
              {(
                [
                  ["content", "Content (modules, pages, assignments, quizzes, files)"],
                  ["roster", "Roster"],
                  ["grades", "Grades and student activity"],
                  ["banks", "Question banks, peer reviews, accommodations, rubric templates"],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300 text-canvas-blue"
                      checked={importSections[key]}
                      onChange={(e) =>
                        setImportSections((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-canvas-secondary text-sm"
                onClick={() => setPendingImport(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-canvas-primary text-sm"
                disabled={
                  !importSections.content &&
                  !importSections.roster &&
                  !importSections.grades &&
                  !importSections.banks
                }
                onClick={confirmImport}
              >
                Continue
              </button>
            </div>
          </div>
        </CanvasModal>
      )}
      <ConfirmActionModal
        isOpen={Boolean(pendingReplacePkg)}
        title="Replace this course?"
        description="All current content, roster, and student activity for this course will be overwritten by the imported package. This cannot be undone."
        confirmText="Replace course"
        tone="danger"
        onClose={() => setPendingReplacePkg(null)}
        onConfirm={confirmReplace}
      />
    </div>
  );
}
