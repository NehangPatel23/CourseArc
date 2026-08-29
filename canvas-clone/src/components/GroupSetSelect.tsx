import { loadGroupSets } from "../utils/groupSets";

export default function GroupSetSelect({
  courseId,
  value,
  onChange,
  disabled,
  hint,
}: {
  courseId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const sets = loadGroupSets(courseId);
  return (
    <div>
      <div className="form-label">Student group set</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="form-input"
      >
        <option value="">No group set (individual)</option>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        {hint ??
          "Optional. Students in the same group share a submission, and grades apply to the group."}
      </p>
    </div>
  );
}
