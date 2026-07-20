import { EyeOff } from "lucide-react";
import Tooltip from "./ui/Tooltip";

export default function HiddenGradeIndicator({
  label = "Grade hidden",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Tooltip label={label}>
      <span
        className={`inline-flex items-center text-gray-400 ${className}`}
        aria-label={label}
      >
        <EyeOff className="h-4 w-4" strokeWidth={2} />
      </span>
    </Tooltip>
  );
}
