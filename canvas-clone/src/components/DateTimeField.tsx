import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  value?: number; // epoch ms
  onChange: (ms: number | undefined) => void;
  description?: string;
  disabled?: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isoFromParts(y: number, m1: number, d: number) {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m, d };
}

function formatDateDisplay(iso: string) {
  const p = parseISODate(iso);
  if (!p) return "";
  return `${pad2(p.m)}/${pad2(p.d)}/${p.y}`;
}

function msToParts(ms?: number) {
  if (!ms) return { dateISO: "", time24: "" };
  const d = new Date(ms);
  const dateISO = isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const time24 = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { dateISO, time24 };
}

// Convert 24h "HH:MM" -> "h:MM AM/PM"
function time24ToDisplay(t24: string) {
  const [hhRaw, mmRaw] = t24.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  const am = hh < 12;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${pad2(mm)} ${am ? "AM" : "PM"}`;
}

// Parse user input like "12:30 PM", "12:30", "7pm", "0730"
function parseTimeInputTo24(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "";

  const norm = s.replace(/\s+/g, " ");

  const m1 = norm.match(/^(\d{1,2})\s*(am|pm)$/);
  if (m1) {
    let h = clamp(Number(m1[1]), 1, 12);
    const ap = m1[2];
    if (ap === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return `${pad2(h)}:00`;
  }

  const m2 = norm.match(/^(\d{3,4})$/);
  if (m2) {
    const digits = m2[1];
    const hh =
      digits.length === 3
        ? Number(digits.slice(0, 1))
        : Number(digits.slice(0, 2));
    const mm =
      digits.length === 3 ? Number(digits.slice(1)) : Number(digits.slice(2));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  const m3 = norm.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m3) {
    let h = Number(m3[1]);
    const mm = m3[2] == null ? 0 : Number(m3[2]);
    const ap = m3[3];

    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
    if (mm < 0 || mm > 59) return null;

    if (ap) {
      h = clamp(h, 1, 12);
      if (ap === "am") h = h === 12 ? 0 : h;
      else h = h === 12 ? 12 : h + 12;
    } else {
      if (h < 0 || h > 23) return null;
    }

    return `${pad2(h)}:${pad2(mm)}`;
  }

  return null;
}

function startOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0, 1);
}
function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
function weekday0Sun(date: Date) {
  return date.getDay();
}

function useOutsideClick(
  refs: Array<React.RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      for (const r of refs) {
        if (r.current && r.current.contains(t)) return;
      }
      onOutside();
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [enabled, onOutside, refs]);
}

export default function DateTimeField({
  label,
  value,
  onChange,
  description,
  disabled,
}: Props) {
  const { dateISO, time24 } = useMemo(() => msToParts(value), [value]);

  // -------------------------
  // Calendar popover state
  // -------------------------
  const [calOpen, setCalOpen] = useState(false);

  const initialMonth = useMemo(() => {
    if (dateISO) {
      const p = parseISODate(dateISO);
      if (p) return { year: p.y, monthIndex0: p.m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), monthIndex0: now.getMonth() };
  }, [dateISO]);

  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth0, setViewMonth0] = useState(initialMonth.monthIndex0);

  useEffect(() => {
    setViewYear(initialMonth.year);
    setViewMonth0(initialMonth.monthIndex0);
  }, [initialMonth.year, initialMonth.monthIndex0]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth0, 1);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [viewYear, viewMonth0]);

  const calGrid = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth0);
    const lead = weekday0Sun(first);
    const dim = daysInMonth(viewYear, viewMonth0);

    const cells: Array<{ y: number; m1: number; d: number; inMonth: boolean }> =
      [];

    const prevMonth0 = viewMonth0 === 0 ? 11 : viewMonth0 - 1;
    const prevYear = viewMonth0 === 0 ? viewYear - 1 : viewYear;
    const prevDim = daysInMonth(prevYear, prevMonth0);

    for (let i = 0; i < lead; i++) {
      const day = prevDim - (lead - 1 - i);
      cells.push({ y: prevYear, m1: prevMonth0 + 1, d: day, inMonth: false });
    }

    for (let d = 1; d <= dim; d++) {
      cells.push({ y: viewYear, m1: viewMonth0 + 1, d, inMonth: true });
    }

    while (cells.length < 42) {
      const nextMonth0 = viewMonth0 === 11 ? 0 : viewMonth0 + 1;
      const nextYear = viewMonth0 === 11 ? viewYear + 1 : viewYear;
      const d = cells.length - (lead + dim) + 1;
      cells.push({ y: nextYear, m1: nextMonth0 + 1, d, inMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth0]);

  // -------------------------
  // Time dropdown state
  // -------------------------
  const [timeOpen, setTimeOpen] = useState(false);
  const [hourFilter, setHourFilter] = useState("");
  const [minFilter, setMinFilter] = useState("");

  const [draftHour12, setDraftHour12] = useState<number>(12);
  const [draftMinute, setDraftMinute] = useState<number>(0);
  const [draftAmpm, setDraftAmpm] = useState<"AM" | "PM">("AM");

  function time24ToDraftParts(t24: string) {
    if (!t24) return { h12: 12, m: 0, ap: "AM" as const };
    const [hhS, mmS] = t24.split(":");
    const hh = Number(hhS);
    const mm = Number(mmS);
    const isAM = hh < 12;
    const h12 = ((hh + 11) % 12) + 1;
    return {
      h12: Number.isFinite(h12) ? h12 : 12,
      m: Number.isFinite(mm) ? mm : 0,
      ap: isAM ? ("AM" as const) : ("PM" as const),
    };
  }

  function draftToTime24(h12: number, m: number, ap: "AM" | "PM") {
    let hh = clamp(h12, 1, 12);
    const mm = clamp(m, 0, 59);
    if (ap === "AM") hh = hh === 12 ? 0 : hh;
    else hh = hh === 12 ? 12 : hh + 12;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  function setTimeFromParts(
    nextHour12: number,
    nextMinute: number,
    nextAmpm: "AM" | "PM",
  ) {
    setDraftHour12(clamp(nextHour12, 1, 12));
    setDraftMinute(clamp(nextMinute, 0, 59));
    setDraftAmpm(nextAmpm);
  }

  const hoursList = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => i + 1);
    const f = hourFilter.trim();
    if (!f) return base;
    return base.filter((h) => String(h).startsWith(f));
  }, [hourFilter]);

  const minsList = useMemo(() => {
    const base = Array.from({ length: 60 }, (_, i) => i);
    const f = minFilter.trim();
    if (!f) return base;
    return base.filter((m) => pad2(m).startsWith(f) || String(m).startsWith(f));
  }, [minFilter]);

  // -------------------------
  // Controlled time input
  // -------------------------
  const [timeText, setTimeText] = useState<string>(() =>
    time24 ? time24ToDisplay(time24) : "",
  );

  // Keep input synced to committed value when popover is closed
  useEffect(() => {
    if (timeOpen) return;
    setTimeText(time24 ? time24ToDisplay(time24) : "");
  }, [time24, timeOpen]);

  // ✅ LIVE PREVIEW: when popover is open, reflect the draft selection in the input box
  useEffect(() => {
    if (!timeOpen) return;
    const t24 = draftToTime24(draftHour12, draftMinute, draftAmpm);
    setTimeText(time24ToDisplay(t24));
  }, [timeOpen, draftHour12, draftMinute, draftAmpm]);

  function commit(dateISO2: string, time24_2: string) {
    if (!dateISO2) {
      onChange(undefined);
      return;
    }

    const p = parseISODate(dateISO2);
    if (!p) return;

    let hh = 0;
    let mm = 0;

    if (time24_2) {
      const [hS, mS] = time24_2.split(":");
      hh = Number(hS);
      mm = Number(mS);
      if (!Number.isFinite(hh)) hh = 0;
      if (!Number.isFinite(mm)) mm = 0;
      hh = clamp(hh, 0, 23);
      mm = clamp(mm, 0, 59);
    }

    onChange(new Date(p.y, p.m - 1, p.d, hh, mm).getTime());
  }

  // -------------------------
  // Outside click handling
  // -------------------------
  const calWrapRef = useRef<HTMLDivElement | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);
  const timeWrapRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick([calWrapRef, dateBtnRef], () => setCalOpen(false), calOpen);
  useOutsideClick([timeWrapRef], () => setTimeOpen(false), timeOpen);

  // -------------------------
  // Styles
  // -------------------------
  const inputBase = [
    "w-full pl-9 pr-3 py-2 border rounded-md text-sm",
    "shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300",
    disabled
      ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
      : "bg-white border-gray-300 text-[#2D3B45] hover:border-gray-400",
  ].join(" ");

  const labelCls = "block text-xs font-medium text-gray-600";
  const helpCls = "text-xs text-gray-500";

  const dateDisplay = dateISO ? formatDateDisplay(dateISO) : "";
  const showTimezoneBelowInputs = !!(description && description.length > 0);

  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>

      <div className="flex gap-3 items-start">
        {/* Date */}
        <div className="relative flex-1">
          <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

          <button
            ref={dateBtnRef}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setCalOpen((v) => !v);
              setTimeOpen(false);
            }}
            className={[
              inputBase,
              "text-left select-none",
              dateDisplay ? "" : "text-gray-400",
              calOpen ? "!border-blue-300 !ring-2 !ring-blue-200" : "",
            ].join(" ")}
          >
            {dateDisplay || "MM/DD/YYYY"}
          </button>

          {calOpen && !disabled && (
            <div
              ref={calWrapRef}
              className="absolute z-[100] mt-2 w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl p-3"
            >
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  className="p-2 rounded-md bg-white hover:bg-gray-50 text-[#2D3B45] border border-transparent"
                  onClick={() => {
                    const m = viewMonth0 - 1;
                    if (m < 0) {
                      setViewMonth0(11);
                      setViewYear((y) => y - 1);
                    } else setViewMonth0(m);
                  }}
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                <div className="text-sm font-semibold text-[#2D3B45]">
                  {monthLabel}
                </div>

                <button
                  type="button"
                  className="p-2 rounded-md bg-white hover:bg-gray-50 text-[#2D3B45] border border-transparent"
                  onClick={() => {
                    const m = viewMonth0 + 1;
                    if (m > 11) {
                      setViewMonth0(0);
                      setViewYear((y) => y + 1);
                    } else setViewMonth0(m);
                  }}
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mt-3 px-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="text-[11px] font-medium text-gray-500 text-center py-1"
                  >
                    {d}
                  </div>
                ))}

                {calGrid.map((c, idx) => {
                  const iso = isoFromParts(c.y, c.m1, c.d);
                  const selected = dateISO && iso === dateISO;

                  const today = (() => {
                    const n = new Date();
                    const tIso = isoFromParts(
                      n.getFullYear(),
                      n.getMonth() + 1,
                      n.getDate(),
                    );
                    return iso === tIso;
                  })();

                  return (
                    <button
                      key={`${iso}_${idx}`}
                      type="button"
                      onClick={() => {
                        commit(iso, time24);
                        setCalOpen(false);
                      }}
                      className={[
                        "h-9 rounded-lg text-sm transition-colors",
                        "flex items-center justify-center",
                        "border border-transparent",
                        c.inMonth ? "text-[#2D3B45]" : "text-gray-400",
                        selected
                          ? "bg-[#008EE2] text-white"
                          : "bg-white hover:bg-gray-50",
                        today && !selected ? "ring-1 ring-[#008EE2]/30" : "",
                      ].join(" ")}
                    >
                      {c.d}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between px-1">
                <button
                  type="button"
                  className="text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-[#2D3B45] border-gray-400"
                  onClick={() => {
                    onChange(undefined);
                    setCalOpen(false);
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="text-xs font-medium bg-white text-[#008EE2] hover:bg-blue-50 border-blue-300"
                  onClick={() => {
                    const n = new Date();
                    const iso = isoFromParts(
                      n.getFullYear(),
                      n.getMonth() + 1,
                      n.getDate(),
                    );
                    commit(iso, time24);
                    setCalOpen(false);
                  }}
                >
                  Today
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Time */}
        <div className="relative w-[140px]" ref={timeWrapRef}>
          <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

          <input
            type="text"
            value={timeText}
            disabled={disabled || !dateISO}
            placeholder="hh:mm AM"
            onFocus={() => {
              if (disabled || !dateISO) return;

              setTimeOpen(true);
              setCalOpen(false);

              const d = time24ToDraftParts(time24);
              setDraftHour12(d.h12);
              setDraftMinute(d.m);
              setDraftAmpm(d.ap);

              setHourFilter("");
              setMinFilter("");
            }}
            onChange={(e) => {
              const next = e.target.value;
              setTimeText(next);

              const parsed = parseTimeInputTo24(next);
              if (parsed === null) return;

              if (parsed === "") {
                setDraftHour12(12);
                setDraftMinute(0);
                setDraftAmpm("AM");
                return;
              }

              const d = time24ToDraftParts(parsed);
              setDraftHour12(d.h12);
              setDraftMinute(d.m);
              setDraftAmpm(d.ap);
            }}
            className={[
              inputBase,
              timeOpen ? "!border-blue-300 !ring-2 !ring-blue-200" : "",
            ].join(" ")}
          />

          {timeOpen && !disabled && !!dateISO && (
            <div className="absolute z-[100] mt-2 right-0 w-[280px] rounded-xl border border-gray-200 bg-white shadow-xl p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[#2D3B45]">Time</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTimeFromParts(draftHour12, draftMinute, "AM")
                    }
                    className={[
                      "px-2 py-1 text-xs rounded-md border",
                      draftAmpm === "AM"
                        ? "bg-[#008EE2] text-white border-[#008EE2]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTimeFromParts(draftHour12, draftMinute, "PM")
                    }
                    className={[
                      "px-2 py-1 text-xs rounded-md border",
                      draftAmpm === "PM"
                        ? "bg-[#008EE2] text-white border-[#008EE2]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    PM
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                {/* Hours */}
                <div>
                  <div className="text-[11px] font-medium text-gray-600 mb-1">
                    Hour
                  </div>
                  <input
                    value={hourFilter}
                    onChange={(e) =>
                      setHourFilter(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder="Filter…"
                    className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm text-[#2D3B45] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="mt-2 max-h-[160px] overflow-auto rounded-md border border-gray-200">
                    {hoursList.map((h) => {
                      const active = h === draftHour12;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() =>
                            setTimeFromParts(h, draftMinute, draftAmpm)
                          }
                          className={[
                            "!appearance-none",
                            "w-full text-left px-2 py-2 text-sm",
                            "border-0 shadow-none rounded-none",
                            active
                              ? "!bg-[#008EE2] !text-white"
                              : "!bg-white !text-[#2D3B45] hover:!bg-gray-50",
                          ].join(" ")}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minutes */}
                <div>
                  <div className="text-[11px] font-medium text-gray-600 mb-1">
                    Minute
                  </div>
                  <input
                    value={minFilter}
                    onChange={(e) =>
                      setMinFilter(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder="Filter…"
                    className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm text-[#2D3B45] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="mt-2 max-h-[160px] overflow-auto rounded-md border border-gray-200">
                    {minsList.map((m) => {
                      const active = m === draftMinute;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setTimeFromParts(draftHour12, m, draftAmpm)
                          }
                          className={[
                            "!appearance-none",
                            "w-full text-left px-2 py-2 text-sm",
                            "border-0 shadow-none rounded-none",
                            active
                              ? "!bg-[#008EE2] !text-white"
                              : "!bg-white !text-[#2D3B45] hover:!bg-gray-50",
                          ].join(" ")}
                        >
                          {pad2(m)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-[#2D3B45] border-gray-400"
                  onClick={() => {
                    setDraftHour12(12);
                    setDraftMinute(0);
                    setDraftAmpm("AM");
                    setHourFilter("");
                    setMinFilter("");
                    // timeText will update via the draft->input effect
                  }}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="text-xs font-medium bg-white text-[#008EE2] hover:bg-blue-50 border-blue-300"
                  onClick={() => {
                    const next24 = draftToTime24(
                      draftHour12,
                      draftMinute,
                      draftAmpm,
                    );
                    commit(dateISO, next24);
                    setTimeOpen(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showTimezoneBelowInputs && <div className={helpCls}>{description}</div>}
    </div>
  );
}
