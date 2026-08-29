import {
  CALENDAR_TYPE_META,
  appointmentChipLabel,
  calendarEventChipAppearance,
  formatEventTime,
  type CalendarEvent,
} from "../utils/calendarEvents";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(events: CalendarEvent[]) {
  const groups: { key: string; date: Date; events: CalendarEvent[] }[] = [];
  const index = new Map<string, number>();
  for (const event of events) {
    const key = dayKey(event.date);
    const i = index.get(key);
    if (i == null) {
      index.set(key, groups.length);
      groups.push({ key, date: event.date, events: [event] });
    } else {
      groups[i].events.push(event);
    }
  }
  return groups;
}

export default function CalendarPrintSheet({
  calendarName,
  viewLabel,
  rangeLabel,
  events,
  weekdayLabels,
  monthCells,
}: {
  calendarName: string;
  viewLabel: string;
  rangeLabel: string;
  events: CalendarEvent[];
  weekdayLabels?: string[];
  monthCells?: { date: Date; day: number; inMonth: boolean }[];
}) {
  const byDay = groupByDay(events);
  const eventsOn = (date: Date) => events.filter((e) => dayKey(e.date) === dayKey(date));
  const printedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="calendar-print-sheet" aria-hidden="true">
      <header className="calendar-print-masthead">
        <p className="calendar-print-kicker">CourseArc calendar</p>
        <h1>{rangeLabel}</h1>
        <p>
          {calendarName}
          {" · "}
          {viewLabel}
          {" · Printed "}
          {printedAt}
        </p>
      </header>

      {monthCells && weekdayLabels && (
        <table className="calendar-print-grid">
          <thead>
            <tr>
              {weekdayLabels.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, row) => (
              <tr key={row}>
                {monthCells.slice(row * 7, row * 7 + 7).map((cell, i) => (
                  <td key={`${cell.date.toISOString()}-${i}`} className={cell.inMonth ? "" : "muted"}>
                    <div className="day-num">{cell.day}</div>
                    {cell.inMonth &&
                      eventsOn(cell.date).map((e) => {
                        const time = formatEventTime(e);
                        const chip = calendarEventChipAppearance(e);
                        return (
                          <div
                            key={e.id}
                            className={chip.unbooked ? "chip chip-open" : "chip"}
                            style={
                              chip.unbooked
                                ? { borderColor: chip.typeColor, color: chip.typeColor }
                                : { backgroundColor: chip.typeColor, color: "#fff" }
                            }
                          >
                            <span
                              className="chip-course-pip"
                              style={{ backgroundColor: chip.courseColor }}
                            />
                            {time ? `${time} · ` : ""}
                            {appointmentChipLabel(e)}
                          </div>
                        );
                      })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="calendar-print-list-title">Schedule</h2>
      {byDay.length === 0 ? (
        <p className="calendar-print-empty">No events in this range.</p>
      ) : (
        byDay.map((group) => (
          <div key={group.key} className="calendar-print-day">
            <h3>
              {group.date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <ul>
              {group.events.map((e) => {
                const time = formatEventTime(e);
                return (
                  <li key={e.id}>
                    <span className="when">{time ?? "—"}</span>
                    <span className="what">
                      <strong>{appointmentChipLabel(e)}</strong>
                      <span className="meta">
                        <span className="chip-course-pip" style={{ backgroundColor: e.color }} />
                        <span style={{ color: e.color }}>{e.courseShortName}</span>
                        {" · "}
                        <span style={{ color: CALENDAR_TYPE_META[e.type].accent }}>
                          {CALENDAR_TYPE_META[e.type].short}
                        </span>
                        {e.location ? ` · ${e.location}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
