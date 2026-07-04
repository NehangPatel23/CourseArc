import { useEffect, useState } from "react";
import {
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

  const openMessage = (id: string) => {
    markMessageRead(id);
    setMessages(loadInboxMessages());
    setSelectedId(id);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-0px)]">
      <div className="w-full max-w-sm shrink-0 border-r border-canvas-border bg-white">
        <div className="flex items-center justify-between border-b border-canvas-border px-4 py-4">
          <h1 className="text-lg font-semibold text-canvas-grayDark">Inbox</h1>
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
        <ul>
          {messages.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => openMessage(m.id)}
                className={`w-full border-b border-canvas-border/60 px-4 py-3 text-left hover:bg-canvas-grayLight ${
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
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 bg-canvas-grayLight p-8">
        {selected ? (
          <article className="max-w-2xl rounded-2xl bg-white p-8 ring-1 ring-canvas-border/80">
            <h2 className="text-xl font-semibold text-canvas-grayDark">{selected.subject}</h2>
            <p className="mt-1 text-sm text-gray-500">From {selected.from}</p>
            <p className="mt-6 whitespace-pre-wrap text-gray-700">{selected.body}</p>
          </article>
        ) : (
          <p className="text-gray-500">Select a message</p>
        )}
      </div>
    </div>
  );
}
