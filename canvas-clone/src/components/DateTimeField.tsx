// src/components/DateTimeField.tsx
import { Calendar, Clock } from "lucide-react";
import { useMemo } from "react";

type Props = {
  label: string;
  value?: number; // epoch ms
  onChange: (ms: number | undefined) => void;
  description?: string;
  disabled?: boolean;
};

function toDateParts(ms?: number) {
  if (!ms) return { date: "", time: "" };

  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");

  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return { date, time };
}

export default function DateTimeField({
  label,
  value,
  onChange,
  description,
  disabled,
}: Props) {
  const { date, time } = useMemo(() => toDateParts(value), [value]);

  function update(newDate: string, newTime: string) {
    if (!newDate) {
      onChange(undefined);
      return;
    }

    const [y, m, d] = newDate.split("-").map(Number);
    const [hh = 0, mm = 0] = newTime.split(":").map(Number);

    const ms = new Date(y, m - 1, d, hh, mm).getTime();
    onChange(ms);
  }

  const inputBase = [
    "w-full pl-9 pr-3 py-2 border rounded-md text-sm",
    "focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300",
    disabled
      ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
      : "bg-white border-gray-300 text-[#2D3B45]",
  ].join(" ");

  return (
    <div>
      {/* ✅ Match other form labels (Title, Points, etc.) */}
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>

      <div className="flex gap-3">
        {/* Date */}
        <div className="relative flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={(e) => update(e.target.value, time)}
            disabled={disabled}
            className={inputBase}
          />
        </div>

        {/* Time */}
        <div className="relative w-[140px] flex-shrink-0">
          <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="time"
            value={time}
            onChange={(e) => update(date, e.target.value)}
            disabled={disabled}
            className={inputBase}
          />
        </div>
      </div>

      {/* ✅ Description BELOW inputs, with same sizing as other helper text */}
      {description && (
        <div className="mt-1 text-[11px] text-gray-500">{description}</div>
      )}
    </div>
  );
}
