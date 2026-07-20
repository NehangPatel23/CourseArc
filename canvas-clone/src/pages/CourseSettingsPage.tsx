import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Settings } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CourseHeader from "../components/CourseHeader";
import LatePenaltyPolicySelect from "../components/LatePenaltyPolicySelect";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import type { AssignmentSubmissionType } from "../utils/assignments";
import {
  archiveCourse,
  COURSE_COLORS,
  deleteCourse,
  getCourseAssignmentDefaults,
  getCourseById,
  updateCourse,
} from "../utils/coursesStore";
import {
  downloadCoursePackage,
  importCoursePackage,
  parseCoursePackage,
} from "../utils/coursePackage";
import {
  STUDENT_COURSE_NAV_ITEMS,
  computeStudentNavHiddenAfterToggle,
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
  const studentView = useStudentView(effectiveCourseId);
  const { showToast } = useToast();
  const course = getCourseById(effectiveCourseId);
  const defaults = getCourseAssignmentDefaults(course);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingReplacePkg, setPendingReplacePkg] = useState<ReturnType<
    typeof parseCoursePackage
  >>(null);

  const [title, setTitle] = useState(course?.title ?? "");
  const [code, setCode] = useState(course?.code ?? "");
  const [shortName, setShortName] = useState(course?.short_name ?? "");
  const [term, setTerm] = useState(course?.term ?? "");
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0]!);
  const [published, setPublished] = useState(course?.published ?? false);
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
    course?.studentNavHidden ?? [],
  );
  const savedGradingScheme = getGradingScheme(effectiveCourseId);
  const [showLetterGrades, setShowLetterGrades] = useState(savedGradingScheme.showLetterGrades);
  const [showOverallPercent, setShowOverallPercent] = useState(savedGradingScheme.showOverallPercent);
  const [gradingBands, setGradingBands] = useState<LetterGradeBand[]>(savedGradingScheme.bands);
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
    if (studentView) {
      navigate(`/courses/${effectiveCourseId}`, { replace: true });
    }
  }, [studentView, navigate, effectiveCourseId]);

  useEffect(() => {
    if (!course) return;
    const nextDefaults = getCourseAssignmentDefaults(course);
    setTitle(course.title);
    setCode(course.code);
    setShortName(course.short_name);
    setTerm(course.term);
    setColor(course.color);
    setPublished(course.published);
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
    setStudentNavHidden(course.studentNavHidden ?? []);
    const scheme = getGradingScheme(course.id);
    setShowLetterGrades(scheme.showLetterGrades);
    setShowOverallPercent(scheme.showOverallPercent);
    setGradingBands(scheme.bands);
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

    return (
      title.trim() !== course.title ||
      code.trim() !== course.code ||
      (shortName.trim() || code.trim()) !== course.short_name ||
      term.trim() !== course.term ||
      color !== course.color ||
      published !== course.published ||
      defaultSubmissionType !== savedDefaults.submissionType ||
      defaultAllowLate !== savedDefaults.allowLateSubmissions ||
      defaultAllowResubmit !== savedDefaults.allowResubmissions ||
      defaultLatePenaltyPresetId !== savedDefaults.latePenaltyPresetId ||
      JSON.stringify(currentCustomRules) !== JSON.stringify(savedCustomRules) ||
      JSON.stringify([...studentNavHidden].sort()) !==
        JSON.stringify([...(course.studentNavHidden ?? [])].sort()) ||
      showLetterGrades !== savedScheme.showLetterGrades ||
      showOverallPercent !== savedScheme.showOverallPercent ||
      JSON.stringify(normalizedBands) !== JSON.stringify(normalizeGradingBands(savedScheme.bands))
    );
  }, [
    course,
    title,
    code,
    shortName,
    term,
    color,
    published,
    defaultSubmissionType,
    defaultAllowLate,
    defaultAllowResubmit,
    defaultLatePenaltyPresetId,
    customLatePenaltyPresets,
    studentNavHidden,
    showLetterGrades,
    showOverallPercent,
    gradingBands,
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
    updateCourse(course.id, {
      title: title.trim(),
      code: code.trim(),
      short_name: shortName.trim() || code.trim(),
      term: term.trim(),
      color,
      published,
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
    });
    if (nextDefaultPreset !== defaultLatePenaltyPresetId) {
      setDefaultLatePenaltyPresetId(nextDefaultPreset);
    }
    setCustomLatePenaltyPresets(normalizedCustomRules);
    setGradingBands(normalizedBands);
    showToast("Course settings saved", "positive");
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

  const handleArchive = () => {
    archiveCourse(course.id);
    showToast("Course archived", "positive");
    navigate("/", { replace: true });
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    deleteCourse(course.id);
    showToast("Course deleted", "positive");
    navigate("/", { replace: true });
  };

  const handleExportPackage = () => {
    if (!downloadCoursePackage(course.id)) {
      showToast("Could not export course package", "negative");
      return;
    }
    showToast("Course package downloaded", "positive");
  };

  const handleImportFile = async (file: File, mode: "new" | "replace") => {
    try {
      const text = await file.text();
      const pkg = parseCoursePackage(JSON.parse(text));
      if (!pkg) {
        showToast("Invalid course package file", "negative");
        return;
      }
      if (mode === "replace") {
        if (pkg.course.id !== course.id) {
          showToast(
            `Replace requires a package for this course (id ${course.id}). Use Import as new course instead.`,
            "negative",
          );
          return;
        }
        setPendingReplacePkg(pkg);
        return;
      }
      const newId = importCoursePackage(pkg, { mode: "new" });
      if (!newId) {
        showToast("Import failed", "negative");
        return;
      }
      showToast("Course imported", "positive");
      navigate(`/courses/${newId}/settings`);
    } catch {
      showToast("Could not read course package", "negative");
    }
  };

  const confirmReplace = () => {
    if (!pendingReplacePkg) return;
    const id = importCoursePackage(pendingReplacePkg, { mode: "replace" });
    setPendingReplacePkg(null);
    if (!id) {
      showToast("Replace failed", "negative");
      return;
    }
    showToast("Course package restored", "positive");
    window.location.reload();
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8 text-canvas-grayDark">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">Course Settings</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Manage course details, defaults, and visibility.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-gray-300 text-canvas-blue"
                />
                <span className="text-gray-700">Published (visible to students)</span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
                  className="mt-1 w-full form-input bg-white"
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
                  className="mt-1 w-full form-input bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used in GradePro when a late submission is graded.
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Grading</h2>
            <p className="mb-4 text-sm text-gray-600">
              Configure letter grade bands and what overall grades students can see.
            </p>
            <div className="space-y-4">
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

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
                          className="mt-1 w-full form-input bg-white"
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
                            className="mt-1 w-full form-input bg-white"
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
                    className="mt-1 w-full form-input bg-white"
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
                      className="mt-1 w-full form-input bg-white"
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

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Course content</h2>
            <p className="mb-4 text-sm text-gray-600">Quick links for course-facing content.</p>
            <Link
              to={`/courses/${effectiveCourseId}/pages/course-home`}
              className="text-sm text-canvas-blue hover:underline"
            >
              Edit course home page →
            </Link>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">
              Import / export package
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Download a JSON package of this course (curriculum, roster, and student activity). File
              binaries are not included. Import as a new course, or replace this course from a
              matching package.
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
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
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
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
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
