import type { AssignmentGroup } from "../utils/coursesStore";

export default function AssignmentGroupSelect({
  groups,
  value,
  onChange,
  weighted,
  disabled,
}: {
  groups: AssignmentGroup[];
  value: string;
  onChange: (id: string) => void;
  weighted?: boolean;
  disabled?: boolean;
}) {
  const showWeight = weighted !== false;
  return (
    <div>
      <div className="form-label">Assignment group</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="form-input"
      >
        <option value="">{showWeight ? "Unweighted" : "No group"}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {showWeight ? ` (${g.weight}%)` : ""}
          </option>
        ))}
      </select>
      {showWeight && !value && (
        <p className="mt-1 text-xs text-gray-500">
          Unweighted items do not count toward the weighted final grade.
        </p>
      )}
    </div>
  );
}
