import { useEffect, useMemo, useState } from "react";
import Icon from "../icons/Icon";
import CanvasModal from "./CanvasModal";
import { loadCourses } from "../utils/coursesStore";
import { loadRoster, type RosterMember } from "../utils/courseRoster";
import { loadGroupSets } from "../utils/groupSets";
import {
  currentInboxViewer,
  fileToInboxAttachment,
  MAX_INBOX_ATTACHMENTS,
  sendInboxMessage,
  type InboxAttachment,
  type InboxParticipant,
} from "../utils/inbox";
import { useToast } from "./ui/Toast";

type Props = {
  initialCourseId?: string;
  initialToIds?: string[];
  onClose: () => void;
  onSent: (threadId: string) => void;
};

type GroupOption = {
  id: string;
  name: string;
  setName: string;
  members: RosterMember[];
};

type PersonSuggestion = { kind: "person"; member: RosterMember };
type GroupSuggestion = { kind: "group"; group: GroupOption };
type RecipientSuggestion = PersonSuggestion | GroupSuggestion;

function memberToParticipant(m: RosterMember): InboxParticipant {
  return { id: m.id, name: m.name, role: m.role };
}

function RecipientField({
  label,
  value,
  onChange,
  query,
  onQuery,
  suggestions,
  placeholder,
  onAddPerson,
  onAddGroup,
}: {
  label: string;
  value: InboxParticipant[];
  onChange: (next: InboxParticipant[]) => void;
  query: string;
  onQuery: (q: string) => void;
  suggestions: RecipientSuggestion[];
  placeholder: string;
  onAddPerson: (member: RosterMember) => void;
  onAddGroup: (group: GroupOption) => void;
}) {
  const first = suggestions[0];
  return (
    <div>
      <span className="form-label">{label}</span>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-arc-line bg-arc-ivory px-2 py-1.5 focus-within:border-arc-copper/40 focus-within:ring-2 focus-within:ring-arc-copper/15">
        {value.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full bg-arc-copper/15 px-2.5 py-0.5 text-xs font-medium text-arc-copper-dark"
          >
            {p.name}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x.id !== p.id))}
              className="rounded-full p-0.5 hover:bg-arc-ivory/80"
              aria-label={`Remove ${p.name}`}
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && value.length > 0) {
              onChange(value.slice(0, -1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (!first) return;
              if (first.kind === "group") onAddGroup(first.group);
              else onAddPerson(first.member);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[10rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-arc-mute"
        />
      </div>
      {suggestions.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-lg border border-arc-line bg-arc-ivory shadow-canvas-dropdown">
          {suggestions.map((s) =>
            s.kind === "group" ? (
              <li key={`g-${s.group.id}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onAddGroup(s.group)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-arc-copper/10"
                >
                  <span className="font-medium text-arc-ink">{s.group.name}</span>
                  <span className="text-xs text-arc-mute">
                    {s.group.setName} · {s.group.members.length}{" "}
                    {s.group.members.length === 1 ? "member" : "members"}
                  </span>
                </button>
              </li>
            ) : (
              <li key={s.member.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onAddPerson(s.member)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-arc-copper/10"
                >
                  <span className="font-medium text-arc-ink">{s.member.name}</span>
                  <span className="text-xs capitalize text-arc-mute">{s.member.role}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function groupsForCompose(
  courseId: string,
  roster: RosterMember[],
  viewerId: string,
  viewerIsStaff: boolean,
): GroupOption[] {
  const byId = new Map(roster.map((m) => [m.id, m]));
  const out: GroupOption[] = [];
  for (const set of loadGroupSets(courseId)) {
    for (const group of set.groups) {
      if (!viewerIsStaff && !group.studentIds.includes(viewerId)) continue;
      const members = group.studentIds
        .map((id) => byId.get(id))
        .filter((m): m is RosterMember => Boolean(m));
      out.push({
        id: group.id,
        name: group.name,
        setName: set.name,
        members,
      });
    }
  }
  return out;
}

export default function InboxComposeModal({
  initialCourseId,
  initialToIds = [],
  onClose,
  onSent,
}: Props) {
  const { showToast } = useToast();
  const viewer = currentInboxViewer();
  const courses = useMemo(
    () => loadCourses(false).filter((c) => (viewer.role === "student" ? c.published : true)),
    [viewer.role],
  );
  const [courseId, setCourseId] = useState(initialCourseId || courses[0]?.id || "");
  const [to, setTo] = useState<InboxParticipant[]>([]);
  const [cc, setCc] = useState<InboxParticipant[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [ccQuery, setCcQuery] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [studentReplies, setStudentReplies] = useState(true);
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);

  const roster = useMemo(
    () => (courseId ? loadRoster(courseId).filter((m) => m.id !== viewer.id) : []),
    [courseId, viewer],
  );

  useEffect(() => {
    if (!courseId || initialToIds.length === 0) return;
    const picked = initialToIds
      .map((id) => roster.find((m) => m.id === id))
      .filter((m): m is RosterMember => Boolean(m))
      .map((m) => ({ id: m.id, name: m.name, role: m.role }));
    if (picked.length) setTo(picked);
  }, [courseId, roster, initialToIds]);

  const taken = new Set([...to, ...cc].map((p) => p.id));
  const groups = useMemo(
    () =>
      courseId
        ? groupsForCompose(courseId, roster, viewer.id, viewer.role !== "student")
        : [],
    [courseId, roster, viewer],
  );

  const filterSuggestions = (query: string): RecipientSuggestion[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const people: RecipientSuggestion[] = roster
      .filter((m) => !taken.has(m.id))
      .filter(
        (m) => m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6)
      .map((member) => ({ kind: "person" as const, member }));
    const matchedGroups: RecipientSuggestion[] = groups
      .filter(
        (g) => g.name.toLowerCase().includes(q) || g.setName.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .map((group) => ({ kind: "group" as const, group }));
    return [...matchedGroups, ...people].slice(0, 8);
  };

  const toSuggestions = filterSuggestions(toQuery);
  const ccSuggestions = filterSuggestions(ccQuery);
  const messagingStudents = [...to, ...cc].some((p) => p.role === "student");
  const canSend = Boolean(courseId && to.length > 0 && subject.trim() && body.trim());

  const mergePeople = (prev: InboxParticipant[], members: RosterMember[]): InboxParticipant[] => {
    const next = [...prev];
    for (const m of members) {
      if (!next.some((p) => p.id === m.id)) next.push(memberToParticipant(m));
    }
    return next;
  };

  const addTo = (member: RosterMember) => {
    setTo((prev) => mergePeople(prev, [member]));
    setToQuery("");
  };
  const addCc = (member: RosterMember) => {
    setCc((prev) => mergePeople(prev, [member]));
    setCcQuery("");
  };

  const addGroupToTo = (group: GroupOption) => {
    if (group.members.length === 0) {
      showToast(`${group.name} has no members to message`, "negative");
      return;
    }
    const already = new Set(to.map((p) => p.id));
    const added = group.members.filter((m) => !already.has(m.id)).length;
    setTo((prev) => mergePeople(prev, group.members));
    setToQuery("");
    setShowGroups(false);
    if (added === 0) {
      showToast(`Everyone in ${group.name} is already on this message`, "positive");
    } else {
      showToast(
        added === 1 ? `Added 1 person from ${group.name}` : `Added ${added} people from ${group.name}`,
        "positive",
      );
    }
  };

  const addGroupToCc = (group: GroupOption) => {
    if (group.members.length === 0) {
      showToast(`${group.name} has no members to message`, "negative");
      return;
    }
    setCc((prev) => mergePeople(prev, group.members));
    setCcQuery("");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_INBOX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      showToast(`Up to ${MAX_INBOX_ATTACHMENTS} attachments`, "negative");
      return;
    }
    try {
      const next = await Promise.all([...files].slice(0, room).map(fileToInboxAttachment));
      setAttachments((prev) => [...prev, ...next]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not attach file", "negative");
    }
  };

  const send = () => {
    if (!canSend) return;
    const message = sendInboxMessage({
      from: viewer.name,
      fromUserId: viewer.id,
      to,
      cc,
      attachments,
      subject: subject.trim(),
      body: body.trim(),
      courseId,
      kind: "direct",
      studentRepliesEnabled: viewer.role === "student" ? undefined : studentReplies,
    });
    showToast(to.length === 1 ? `Sent to ${to[0]!.name}` : `Sent to ${to.length} people`, "positive");
    onSent(message.threadId ?? message.id);
  };

  return (
    <CanvasModal
      title="New message"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-canvas-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={send}
            className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="form-label">Course</span>
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTo([]);
              setCc([]);
              setShowGroups(false);
            }}
            className="form-input"
          >
            {courses.length === 0 && <option value="">No courses</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </label>

        <RecipientField
          label="To"
          value={to}
          onChange={setTo}
          query={toQuery}
          onQuery={setToQuery}
          suggestions={toSuggestions}
          placeholder="Search people or groups…"
          onAddPerson={addTo}
          onAddGroup={addGroupToTo}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setShowGroups((open) => !open)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-arc-copper hover:underline"
            >
              <Icon name="users" size={14} />
              Add group
            </button>
          )}
          {!showCc ? (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-xs font-medium text-arc-copper hover:underline"
            >
              Add CC
            </button>
          ) : null}
        </div>
        {showGroups && groups.length > 0 && (
          <ul className="overflow-hidden rounded-lg border border-arc-line bg-arc-ivory shadow-canvas-dropdown">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => addGroupToTo(g)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-arc-copper/10"
                >
                  <span className="font-medium text-arc-ink">{g.name}</span>
                  <span className="text-xs text-arc-mute">
                    {g.setName} · {g.members.length} {g.members.length === 1 ? "member" : "members"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {showCc ? (
          <RecipientField
            label="CC"
            value={cc}
            onChange={setCc}
            query={ccQuery}
            onQuery={setCcQuery}
            suggestions={ccSuggestions}
            placeholder="Search people or groups…"
            onAddPerson={addCc}
            onAddGroup={addGroupToCc}
          />
        ) : null}

        <label className="block">
          <span className="form-label">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="form-input"
          />
        </label>

        <label className="block">
          <span className="form-label">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            placeholder="Write your message…"
            className="form-input resize-y"
          />
        </label>

        <div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-arc-copper">
            <Icon name="paperclip" size={16} />
            Attach file
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-1 text-[11px] text-arc-mute">Up to 3 files, 400 KB each (stored in this browser).</p>
          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {attachments.map((a) => (
                <li
                  key={a.name + a.size}
                  className="flex items-center justify-between rounded-lg bg-arc-paper px-3 py-1.5 text-xs text-arc-ink/80"
                >
                  <span className="truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x !== a))}
                    className="ml-2 text-arc-mute hover:text-arc-brick"
                    aria-label={`Remove ${a.name}`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {viewer.role !== "student" && messagingStudents && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-arc-line bg-arc-paper/70 px-3.5 py-3">
            <input
              type="checkbox"
              checked={studentReplies}
              onChange={(e) => setStudentReplies(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-arc-line text-arc-copper focus:ring-canvas-blue"
            />
            <span>
              <span className="block text-sm font-medium text-arc-ink">
                Enable student replies
              </span>
              <span className="mt-0.5 block text-xs text-arc-mute">
                Students can write back in this conversation. Turn this off for one-way notices.
              </span>
            </span>
          </label>
        )}
      </div>
    </CanvasModal>
  );
}
