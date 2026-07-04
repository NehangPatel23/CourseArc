import {
  getDefaultLatePenaltyPresets,
  type LatePenaltyPreset,
} from "../utils/latePenalty";

type LatePenaltyPolicySelectProps = {
  value: string;
  onChange: (presetId: string) => void;
  customPresets?: LatePenaltyPreset[];
  className?: string;
  id?: string;
};

export default function LatePenaltyPolicySelect({
  value,
  onChange,
  customPresets = [],
  className = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
  id,
}: LatePenaltyPolicySelectProps) {
  const defaultPresets = getDefaultLatePenaltyPresets();

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <optgroup label="Defaults">
        {defaultPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Custom policies">
        {customPresets.length === 0 ? (
          <option disabled value="">
            No custom policies — add them in course settings
          </option>
        ) : (
          customPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))
        )}
      </optgroup>
    </select>
  );
}
