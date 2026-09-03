import { CalendarPlus, Copy } from "lucide-react";
import { useToast } from "./ui/Toast";
import {
  copyAppointmentGroupIcs,
  copyAppointmentSlotIcs,
  downloadAppointmentGroupIcs,
  downloadAppointmentSlotIcs,
} from "../utils/appointmentIcs";
import type { AppointmentGroup, AppointmentSlot } from "../utils/appointmentGroups";

export default function AppointmentIcsActions({
  group,
  slot,
  compact = false,
}: {
  group: AppointmentGroup;
  slot?: AppointmentSlot;
  compact?: boolean;
}) {
  const { showToast } = useToast();
  const btn = compact
    ? "btn-canvas-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
    : "btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm";

  const download = () => {
    if (slot) downloadAppointmentSlotIcs(group, slot);
    else downloadAppointmentGroupIcs(group);
  };

  const copy = async () => {
    try {
      if (slot) await copyAppointmentSlotIcs(group, slot);
      else await copyAppointmentGroupIcs(group);
      showToast("Copied calendar invite", "positive", "created");
    } catch {
      showToast("Could not copy", "negative");
    }
  };

  return (
    <>
      <button type="button" onClick={download} className={btn}>
        <CalendarPlus className="h-3.5 w-3.5" />
        Add to calendar
      </button>
      <button type="button" onClick={() => void copy()} className={btn}>
        <Copy className="h-3.5 w-3.5" />
        Copy .ics
      </button>
    </>
  );
}
