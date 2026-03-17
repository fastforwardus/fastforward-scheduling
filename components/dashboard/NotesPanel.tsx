"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Trash2, Loader2, StickyNote } from "lucide-react";

interface Note {
  id: string;
  appointmentId: string;
  userId: string | null;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

// Color por rol/usuario — consistente y distinguible
const AUTHOR_COLORS: Record<string, { bg: string; border: string; name: string; dot: string }> = {
  admin:         { bg: "#EEF2FF", border: "#C7D2FE", name: "#3730A3", dot: "#6366F1" },
  sales_manager: { bg: "#FFF7ED", border: "#FED7AA", name: "#92400E", dot: "#F97316" },
  sales_rep:     { bg: "#F0FDF4", border: "#BBF7D0", name: "#14532D", dot: "#22C55E" },
};

// Si hay varios sales_reps, diferenciarlos por nombre
const EXTRA_COLORS = [
  { bg: "#FDF4FF", border: "#E9D5FF", name: "#581C87", dot: "#A855F7" },
  { bg: "#FFF1F2", border: "#FECDD3", name: "#881337", dot: "#F43F5E" },
  { bg: "#F0F9FF", border: "#BAE6FD", name: "#0C4A6E", dot: "#0EA5E9" },
  { bg: "#FEFCE8", border: "#FEF08A", name: "#713F12", dot: "#EAB308" },
];

function getAuthorColor(role: string, authorName: string, allAuthors: string[]) {
  if (role === "admin") return AUTHOR_COLORS.admin;
  if (role === "sales_manager") return AUTHOR_COLORS.sales_manager;
  // Para sales_reps, asignar color por índice del nombre
  const idx = allAuthors.indexOf(authorName) % EXTRA_COLORS.length;
  return EXTRA_COLORS[idx >= 0 ? idx : 0];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

export function NotesPanel({
  appointmentId,
  currentUserId,
  currentRole,
}: {
  appointmentId: string;
  currentUserId: string;
  currentRole: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const allAuthors = [...new Set(notes.map(n => n.authorName))];

  async function loadNotes() {
    const res = await fetch(`/api/appointments/notes?appointmentId=${appointmentId}`);
    const data = await res.json();
    setNotes(data.notes || []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch("/api/appointments/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, content: text }),
    });
    const data = await res.json();
    if (data.ok) {
      setNotes(prev => [...prev, data.note]);
      setText("");
    }
    setSending(false);
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    await fetch(`/api/appointments/notes?noteId=${noteId}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
         style={{ background: "white", border: "1px solid #E5E7EB", maxHeight: "480px" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b"
           style={{ borderColor: "#E5E7EB", background: "#F8F9FB" }}>
        <StickyNote className="w-4 h-4" style={{ color: "#27295C" }} />
        <span className="text-sm font-semibold" style={{ color: "#27295C" }}>
          Notas internas
        </span>
        {notes.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: "rgba(39,41,92,0.08)", color: "#27295C" }}>
            {notes.length}
          </span>
        )}
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: "120px" }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#9CA3AF" }} />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Sin notas aún. Sé el primero en agregar una.</p>
          </div>
        ) : (
          notes.map((note) => {
            const colors = getAuthorColor(note.authorRole, note.authorName, allAuthors);
            const isOwn = note.userId === currentUserId;
            const canDelete = isOwn || currentRole === "admin";

            return (
              <div key={note.id} className="group relative">
                <div className="rounded-xl px-4 py-3 transition-all"
                     style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>

                  {/* Author row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                           style={{ background: colors.dot, fontSize: "10px" }}>
                        {note.authorName[0]}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: colors.name }}>
                        {note.authorName}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: colors.border, color: colors.name, fontSize: "10px" }}>
                        {note.authorRole === "admin" ? "Admin" : note.authorRole === "sales_manager" ? "Manager" : "Sales"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: colors.name, opacity: 0.6 }}>
                        {timeAgo(note.createdAt)}
                      </span>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: colors.name, opacity: deletingId === note.id ? 1 : undefined }}>
                          {deletingId === note.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.name }}>
                    {note.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Agregar nota interna... (Enter para enviar)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              border: "1.5px solid #E5E7EB",
              color: "#111827",
              background: "#F8F9FB",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
            onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-10 h-10 self-end rounded-xl flex items-center justify-center transition-all"
            style={{
              background: !text.trim() ? "#E5E7EB" : "#27295C",
              color: !text.trim() ? "#9CA3AF" : "white",
            }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>
          Solo visible para el equipo · Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
