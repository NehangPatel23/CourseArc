import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import AppEmptyState from "./AppEmptyState";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_LOG_CHANGED_EVENT,
  auditEntriesForCourse,
  loadAuditLog,
  type AuditAction,
  type AuditEntry,
} from "../utils/auditLog";

const ACTION_ORDER: AuditAction[] = [
  "quiz_key_changed",
  "quiz_regrade",
  "quiz_score_override",
  "quiz_question_score",
  "assignment_regrade",
  "sync_import",
  "sync_conflict_resolved",
];

const ACTION_META: Record<
  AuditAction,
  { icon: IconName; chip: string; iconWrap: string }
> = {
  quiz_key_changed: {
    icon: "pencil",
    chip: "bg-arc-copper-tint text-arc-copper-dark",
    iconWrap: "bg-arc-copper-tint text-arc-copper",
  },
  quiz_regrade: {
    icon: "restore",
    chip: "bg-emerald-50 text-emerald-800",
    iconWrap: "bg-emerald-50 text-emerald-700",
  },
  quiz_score_override: {
    icon: "trend",
    chip: "bg-amber-50 text-amber-900",
    iconWrap: "bg-amber-50 text-amber-800",
  },
  quiz_question_score: {
    icon: "clipboard",
    chip: "bg-sky-50 text-sky-900",
    iconWrap: "bg-sky-50 text-sky-800",
  },
  assignment_regrade: {
    icon: "checkSquare",
    chip: "bg-stone-100 text-stone-800",
    iconWrap: "bg-stone-100 text-stone-700",
  },
  sync_import: {
    icon: "upload",
    chip: "bg-violet-50 text-violet-900",
    iconWrap: "bg-violet-50 text-violet-800",
  },
  sync_conflict_resolved: {
    icon: "warning",
    chip: "bg-rose-50 text-rose-900",
    iconWrap: "bg-rose-50 text-rose-800",
  },
};

function formatWhen(at: number) {
  try {
    return new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(at);
  }
}

function formatRelative(at: number) {
  const delta = Date.now() - at;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Just now";
  if (delta < hour) {
    const n = Math.max(1, Math.round(delta / minute));
    return `${n} min ago`;
  }
  if (delta < day) {
    const n = Math.max(1, Math.round(delta / hour));
    return `${n}h ago`;
  }
  if (delta < 14 * day) {
    const n = Math.max(1, Math.round(delta / day));
    return n === 1 ? "Yesterday" : `${n}d ago`;
  }
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayKey(at: number) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(at: number) {
  const d = new Date(at);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startThat) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

type Filter = "all" | AuditAction;

export default function AuditLogPanel({
  courseId,
  embedded = false,
}: {
  courseId?: string;
  embedded?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(AUDIT_LOG_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(AUDIT_LOG_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const entries = useMemo(() => {
    void tick;
    return courseId ? auditEntriesForCourse(courseId) : loadAuditLog();
  }, [courseId, tick]);

  const counts = useMemo(() => {
    const byAction = {} as Record<AuditAction, number>;
    for (const action of ACTION_ORDER) byAction[action] = 0;
    for (const e of entries) byAction[e.action] += 1;
    return byAction;
  }, [entries]);

  const visible = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.action === filter)).slice(0, 80),
    [entries, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of visible) {
      const key = dayKey(e.at);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [visible]);

  const keyCount = counts.quiz_key_changed;
  const regradeCount = counts.quiz_regrade + counts.assignment_regrade;
  const overrideCount = counts.quiz_score_override + counts.quiz_question_score;

  if (entries.length === 0) {
    return (
      <AppEmptyState
        variant="list"
        compact={embedded}
        studio="instructor"
        title="No audit events yet"
        subtitle="Answer-key edits, regrades, score overrides, and device-sync merges will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Events" value={entries.length} hint="Stored on this device" />
          <StatCard label="Answer keys" value={keyCount} hint="Quiz question edits" />
          <StatCard label="Regrades" value={regradeCount} hint="Quiz and assignment" />
          <StatCard label="Overrides" value={overrideCount} hint="Scores and question points" />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={entries.length}
        />
        {ACTION_ORDER.filter((action) => counts[action] > 0).map((action) => (
          <FilterChip
            key={action}
            active={filter === action}
            onClick={() => setFilter(action)}
            label={AUDIT_ACTION_LABELS[action]}
            count={counts[action]}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-arc-line bg-arc-ivory px-4 py-8 text-center text-sm text-arc-mute">
          No events in this category.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([key, rows]) => (
            <section key={key}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg font-medium italic text-arc-ink">
                  {dayLabel(rows[0].at)}
                </h3>
                <span className="text-xs tabular-nums text-arc-mute">
                  {rows.length} {rows.length === 1 ? "event" : "events"}
                </span>
              </div>
              <ol className="relative space-y-0 border-l border-arc-line ml-4">
                {rows.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-arc-line bg-arc-ivory px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-arc-mute">{label}</p>
      <p className="mt-1 font-display text-3xl font-medium tabular-nums text-arc-ink">{value}</p>
      <p className="mt-0.5 text-xs text-arc-mute">{hint}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-arc-copper bg-arc-copper-tint text-arc-copper-dark"
          : "border-arc-line bg-arc-ivory text-arc-ink/80 hover:border-arc-copper/40 hover:bg-arc-paper"
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? "text-arc-copper" : "text-arc-mute"}`}>{count}</span>
    </button>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const meta = ACTION_META[entry.action];
  return (
    <li className="relative pl-8 py-3.5 first:pt-1">
      <span
        className={`absolute -left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-arc-paper ${meta.iconWrap}`}
        aria-hidden
      >
        <Icon name={meta.icon} size={14} />
      </span>
      <div className="rounded-xl border border-arc-line bg-arc-ivory px-4 py-3.5 transition hover:border-arc-copper/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.chip}`}
              >
                {AUDIT_ACTION_LABELS[entry.action]}
              </span>
            </div>
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-arc-ink">{entry.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-arc-mute">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-arc-cream text-[10px] font-semibold text-arc-ink"
                aria-hidden
              >
                {initials(entry.actorName)}
              </span>
              <span className="text-arc-ink/80">{entry.actorName}</span>
              {entry.detail ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{entry.detail}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <time
              dateTime={new Date(entry.at).toISOString()}
              title={new Date(entry.at).toLocaleString()}
              className="text-right text-xs text-arc-mute"
            >
              <span className="block font-medium text-arc-ink/70">{formatRelative(entry.at)}</span>
              <span className="mt-0.5 block tabular-nums">{formatWhen(entry.at)}</span>
            </time>
            {entry.href && (
              <Link
                to={entry.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-arc-copper hover:underline"
              >
                Open
                <Icon name="arrowUpRight" size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
