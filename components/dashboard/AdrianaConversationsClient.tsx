"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import {
  MessageCircle, Search, ChevronLeft, Mail, Building2,
  Globe, Calendar, Star, Loader2, User, Bot, RefreshCw,
} from "lucide-react";

interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface ConvListItem {
  id: string;
  waPhone: string;
  waProfileName: string | null;
  language: "es" | "en" | "pt" | null;
  timezone: string | null;
  leadName: string | null;
  leadEmail: string | null;
  leadCompany: string | null;
  leadCountry: string | null;
  leadProductType: string | null;
  leadChannel: string | null;
  leadTimeline: string | null;
  zohoLeadId: string | null;
  appointmentId: string | null;
  bookedAt: string | null;
  surveyDoneAt: string | null;
  status: string;
  lastUserMsgAt: string | null;
  lastAssistantMsgAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  satisfactionScore: number | null;
}

interface ConvDetail {
  conversation: ConvListItem;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: unknown;
    createdAt: string;
    tokensIn: number | null;
    tokensOut: number | null;
  }>;
  satisfaction: { score: number; comment: string | null; createdAt: string } | null;
  appointment: {
    id: string;
    clientName: string;
    clientEmail: string;
    scheduledAt: string;
    clientTimezone: string;
    status: string;
    platform: string;
    meetingLink: string | null;
    clientNotes: string | null;
  } | null;
}

interface Stats { total: number; booked: number; survey: number; }

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (b && typeof b === "object" && "type" in b) {
          const block = b as { type: string; text?: string; name?: string; input?: unknown };
          if (block.type === "text" && block.text) return block.text;
          if (block.type === "tool_use") return `🔧 Tool: ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`;
          if (block.type === "tool_result") return `← Resultado tool`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return JSON.stringify(content).slice(0, 200);
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function AdrianaConversationsClient({ user }: { user: SessionUser }) {
  const [conversations, setConversations] = useState<ConvListItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, booked: 0, survey: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConvDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filtros
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (lang) params.set("lang", lang);
      if (status) params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/admin/adriana/conversations?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setConversations(data.conversations || []);
      setStats(data.stats || { total: 0, booked: 0, survey: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, [q, lang, status, dateFrom, dateTo]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/adriana/conversations/${id}`, { cache: "no-store" });
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId, fetchDetail]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* ── LISTA ────────────────────────────── */}
        <aside className={`${selectedId ? "hidden md:flex" : "flex"} md:w-96 w-full flex-col border-r border-slate-200 bg-white`}>
          {/* Header lista */}
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <h1 className="text-lg font-semibold">Adriana — Conversaciones</h1>
              <button onClick={fetchList} className="ml-auto p-1.5 hover:bg-slate-100 rounded" title="Refrescar">
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 rounded p-2 text-center">
                <div className="text-slate-500">Total</div>
                <div className="font-semibold text-slate-900 text-base">{stats.total}</div>
              </div>
              <div className="bg-emerald-50 rounded p-2 text-center">
                <div className="text-emerald-700">Agendaron</div>
                <div className="font-semibold text-emerald-900 text-base">{stats.booked}</div>
              </div>
              <div className="bg-amber-50 rounded p-2 text-center">
                <div className="text-amber-700">Encuesta</div>
                <div className="font-semibold text-amber-900 text-base">{stats.survey}</div>
              </div>
            </div>

            {/* Búsqueda + filtros */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar nombre, email, teléfono, empresa..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5">
                <option value="">Todos los idiomas</option>
                <option value="es">🇪🇸 ES</option>
                <option value="en">🇺🇸 EN</option>
                <option value="pt">🇧🇷 PT</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5">
                <option value="">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="closed">Cerrada</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" />
            </div>
          </div>

          {/* Items lista */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-slate-400 p-8 text-sm">Sin conversaciones</div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition ${selectedId === c.id ? "bg-emerald-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 truncate">
                          {c.leadName || c.waProfileName || `+${c.waPhone}`}
                        </span>
                        {c.language && <span className="text-xs">{c.language === "es" ? "🇪🇸" : c.language === "en" ? "🇺🇸" : "🇧🇷"}</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.leadCompany || c.leadEmail || `+${c.waPhone}`}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {c.bookedAt && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">✓ Agendó</span>}
                        {c.satisfactionScore !== null && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            {"★".repeat(c.satisfactionScore)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{c.messageCount} msgs</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">
                      {fmtDateShort(c.lastUserMsgAt || c.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── DETALLE ────────────────────────────── */}
        <section className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-white`}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Selecciona una conversación
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">Sin datos</div>
          ) : (
            <>
              {/* Header detalle */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden p-1 hover:bg-slate-200 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">
                    {detail.conversation.leadName || detail.conversation.waProfileName || "Sin nombre"}
                  </div>
                  <div className="text-xs text-slate-500">+{detail.conversation.waPhone}</div>
                </div>
                {detail.conversation.bookedAt && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
                    ✓ Agendó
                  </span>
                )}
              </div>

              {/* Panel datos del lead (colapsable en mobile) */}
              <details className="border-b border-slate-200" open>
                <summary className="p-3 cursor-pointer text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Datos del lead
                </summary>
                <div className="px-4 pb-3 text-xs space-y-1 text-slate-600">
                  {detail.conversation.leadEmail && <div className="flex gap-2"><Mail className="w-3.5 h-3.5" /> {detail.conversation.leadEmail}</div>}
                  {detail.conversation.leadCompany && <div className="flex gap-2"><Building2 className="w-3.5 h-3.5" /> {detail.conversation.leadCompany}</div>}
                  {detail.conversation.leadCountry && <div className="flex gap-2"><Globe className="w-3.5 h-3.5" /> {detail.conversation.leadCountry}</div>}
                  {detail.conversation.leadProductType && <div>Producto: <span className="font-medium">{detail.conversation.leadProductType}</span></div>}
                  {detail.conversation.leadChannel && <div>Canal: {detail.conversation.leadChannel}</div>}
                  {detail.conversation.leadTimeline && <div>Timeline: {detail.conversation.leadTimeline}</div>}
                  {detail.conversation.zohoLeadId && (
                    <div className="text-emerald-700">✓ Zoho Lead ID: {detail.conversation.zohoLeadId}</div>
                  )}
                </div>
              </details>

              {/* Appointment vinculada */}
              {detail.appointment && (
                <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 text-sm">
                  <div className="flex items-center gap-2 font-medium text-emerald-900">
                    <Calendar className="w-4 h-4" /> Cita agendada
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    {fmtDateTime(detail.appointment.scheduledAt)} ({detail.appointment.clientTimezone})
                  </div>
                  <div className="text-xs text-emerald-700">Status: {detail.appointment.status}</div>
                  {detail.appointment.meetingLink && (
                    <a href={detail.appointment.meetingLink} target="_blank" rel="noopener" className="text-xs text-emerald-700 underline">
                      Link videollamada →
                    </a>
                  )}
                </div>
              )}

              {/* Satisfaction */}
              {detail.satisfaction && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-600" />
                    <span className="font-medium">Encuesta: {detail.satisfaction.score}/5</span>
                  </div>
                  {detail.satisfaction.comment && (
                    <div className="text-xs text-amber-800 mt-1 italic">&ldquo;{detail.satisfaction.comment}&rdquo;</div>
                  )}
                </div>
              )}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {detail.messages.map((m) => {
                  const text = extractTextFromContent(m.content);
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isUser ? "bg-white border border-slate-200" : "bg-emerald-600 text-white"}`}>
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                          {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span>{isUser ? "Usuario" : "Adriana"}</span>
                          <span>·</span>
                          <span>{fmtTime(m.createdAt)}</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">{text || <em className="opacity-60">[sin texto]</em>}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
