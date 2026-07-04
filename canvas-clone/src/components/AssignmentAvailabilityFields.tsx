import {
  formatAssignmentDueDate,
  hasAvailabilityWindow,
  type Assignment,
} from "../utils/assignments";

export function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm text-gray-600">
      <span className="font-semibold text-canvas-grayDark">{label}</span>{" "}
      <span>{value}</span>
    </div>
  );
}

export default function AssignmentAvailabilityFields({
  assignment,
}: {
  assignment: Pick<Assignment, "availableFrom" | "availableUntil">;
}) {
  if (!hasAvailabilityWindow(assignment)) return null;

  return (
    <>
      {typeof assignment.availableFrom === "number" && (
        <MetadataItem
          label="Available from"
          value={formatAssignmentDueDate(assignment.availableFrom)}
        />
      )}
      {typeof assignment.availableUntil === "number" && (
        <MetadataItem
          label="Available until"
          value={formatAssignmentDueDate(assignment.availableUntil)}
        />
      )}
    </>
  );
}
