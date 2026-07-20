import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import AppEmptyState from "../components/AppEmptyState";
import {
  deleteMessage,
  deleteReadMessages,
  loadInboxMessages,
  markAllRead,
  markMessageRead,
  type InboxMessage,
} from "../utils/inbox";

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>(() => loadInboxMessages());
  const [selectedId, setSelectedId] = useState<string | null>(messages[0]?.id ?? null);

  useEffect(() => {
    const refresh = () => setMessages(loadInboxMessages());
    window.addEventListener("canvasClone:inboxChanged", refresh);
    return () => window.removeEventListener("canvasClone:inboxChanged", refresh);
  }, []);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const readCount = messages.filter((m) => !m.unread).length;

  const openMessage = (id: string) => {
    markMessageRead(id);
    setMessages(loadInboxMessages());
    setSelectedId(id);
  };

  const removeMessage = (id: string) => {
    const next = deleteMessage(id);
    setMessages(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const removeAllRead = () => {
    if (readCount === 0) return;
    if (
      !window.confirm(
        `Delete ${readCount} read message${readCount === 1 ? "" : "s"}? Unread messages will be kept.`,
      )
    ) {
      return;
    }
    const next = deleteReadMessages();
    setMessages(next);
    if (selectedId && !next.some((m) => m.id === selectedId)) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-0px)]">
      <div className="w-full max-w-sm shrink-0 border-r border-canvas-border bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-canvas-border px-4 py-4">
          <h1 className="text-lg font-semibold text-canvas-grayDark">Inbox</h1>
          <div className="flex shrink-0 items-center gap-3">
            {readCount > 0 && (
              <button
                type="button"
                onClick={removeAllRead}
                className="text-xs text-red-600 hover:underline"
              >
                Delete read
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                markAllRead();
                setMessages(loadInboxMessages());
              }}
              className="text-xs text-canvas-blue hover:underline"
            >
              Mark all read
            </button>
          </div>
        </div>
        {messages.length === 0 ? (
          <div className="p-4">
            <AppEmptyState
              variant="inbox"
              title="Inbox is empty"
              subtitle="Messages from instructors and CourseArc will appear here."
              compact
            />
          </div>
        ) : (
          <ul>
            {messages.map((m) => (
              <li key={m.id} className="group relative border-b border-canvas-border/60">
                <button
                  type="button"
                  onClick={() => openMessage(m.id)}
                  className={`w-full px-4 py-3 pr-10 text-left hover:bg-canvas-grayLight ${
                    selectedId === m.id ? "bg-canvas-blue/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {m.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-canvas-red" />
                    )}
                    <span className="truncate text-sm font-medium text-canvas-grayDark">
                      {m.from}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-600">{m.subject}</p>
                  <p className="truncate text-xs text-gray-400">{m.preview}</p>
                </button>
                {!m.unread && (
                  <button
                    type="button"
                    title="Delete message"
                    aria-label={`Delete ${m.subject}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMessage(m.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-1 items-stretch justify-stretch bg-white">
        {selected ? (
          <article className="w-full bg-white p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-canvas-grayDark">
                  {selected.subject}
                </h2>
                <p className="mt-1 text-sm text-gray-500">From {selected.from}</p>
              </div>
              {!selected.unread && (
                <button
                  type="button"
                  onClick={() => removeMessage(selected.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
            {selected.courseId && (
              <a
                href={`/courses/${selected.courseId}`}
                className="mt-2 inline-block text-sm text-canvas-blue hover:underline"
              >
                Open course →
              </a>
            )}
            <p className="mt-6 whitespace-pre-wrap text-gray-700">{selected.body}</p>
          </article>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-canvas-grayLight p-8">
            <AppEmptyState
              variant="inbox"
              title="Select a message"
              subtitle="Choose a conversation from the list to read it here."
            />
          </div>
        )}
      </div>
    </div>
  );
}
