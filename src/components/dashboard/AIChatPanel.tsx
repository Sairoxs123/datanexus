import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Plus, ChevronLeft, Send, Loader2, MessageSquare,
  Sparkles, Database, Table2, ChevronDown, ChevronUp, Pencil, Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../utils/api";
import type { CanvasData } from "./AICanvas";

const API_BASE = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Thread {
  id: string;
  name: string;
  last_message_at?: string;
  created_at?: string;
}

// Messages come straight from LangGraph checkpoints — no canvas attached
interface Message {
  id: string;
  role: "user" | "assistant" | "canvas";
  content?: string;
  sql_query?: string;
  sql_params?: any[];
  canvas_data?: Record<string, unknown>;
  isStreaming?: boolean;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCanvasData: (data: CanvasData) => void;
}

type PanelView = "threads" | "chat";

function formatThreadDate(thread: Thread) {
  const dateValue = thread.last_message_at ?? thread.created_at;
  if (!dateValue) return "No activity yet";

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "No activity yet"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIChatPanel({ isOpen, onClose, onCanvasData }: AIChatPanelProps) {
  const MIN_PANEL_WIDTH = 320;
  const MAX_PANEL_WIDTH = 700;

  const [panelView, setPanelView] = useState<PanelView>("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingCanvas, setLoadingCanvas] = useState<Record<string, boolean>>({});
  const [threadActionLoading, setThreadActionLoading] = useState<Record<string, boolean>>({});
  const [renameTarget, setRenameTarget] = useState<Thread | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { if (isOpen) loadThreads(); }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      const clampedWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, nextWidth));
      setPanelWidth(clampedWidth);
    };

    const onMouseUp = () => setIsResizingPanel(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizingPanel]);

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await api.get<Thread[]>("/get-chat-sessions");
      setThreads(Array.isArray(res.data) ? res.data : []);
    } catch { setThreads([]); }
    finally { setLoadingThreads(false); }
  };

  const openThread = async (thread: Thread) => {
    setActiveThreadId(thread.id);
    setPanelView("chat");
    setLoadingMessages(true);
    setMessages([]);

    // Fetch messages (from LangGraph)
    try {
      const msgRes = await api.get<{ role: "user" | "assistant" | "canvas"; content?: string; sql_query?: string; sql_params?: any[] }[]>(
        `/get-chat-messages/${thread.id}`
      );

      setMessages(
        msgRes.data.map((m, i) => {
          let parsedParams = m.sql_params;
          if (Array.isArray(m.sql_params)) {
             parsedParams = m.sql_params.map(p => typeof p === "string" ? JSON.parse(p) : p);
          }
          return {
            id: `hist-${i}`,
            role: m.role,
            content: m.content || "",
            sql_query: m.sql_query,
            sql_params: parsedParams,
          };
        })
      );
    } catch { /* silent */ }
    finally { setLoadingMessages(false); }
  };

  const showStatus = useCallback((text: string) => {
    setStatusText(text);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusText(null), 6000);
  }, []);

  const streamMessage = async (threadId: string, userMessage: string) => {
    setIsStreaming(true);
    const streamId = `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "assistant", content: "", isStreaming: true },
    ]);

    let accContent = "";

    try {
      const response = await fetch(`${API_BASE}/send-ai-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message: userMessage }),
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { break outer; }
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "text") {
              accContent += ev.data;
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: accContent } : m)
              );
            } else if (ev.type === "status") {
              showStatus(ev.data);
            } else if (ev.type === "canvas_table") {
              // Surface canvas to parent immediately; we also add to messages
              const payload = ev.data;
              const rows: Record<string, unknown>[] = Array.isArray(payload)
                ? payload
                : (payload.rows ?? []);
              const columns: string[] = payload.columns ??
                (rows.length > 0 ? Object.keys(rows[0]) : []);
              onCanvasData({ rows, columns });

              setMessages((prev) => [
                ...prev,
                { id: `live-${Date.now()}`, role: "canvas", sql_query: payload.sql_query, sql_params: payload.sql_params, canvas_data: { rows, columns } },
              ]);
            } else if (ev.type === "chat_name_update") {
              setThreads((prev) =>
                prev.map((t) => t.id === threadId ? { ...t, name: ev.data } : t)
              );
            }
          } catch { /* skip bad JSON */ }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId
            ? { ...m, content: accContent || "Sorry, something went wrong.", isStreaming: false }
            : m
        )
      );
      setIsStreaming(false);
      setStatusText(null);
    }
  };

  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || isStreaming) return;
    setInputValue("");

    if (!activeThreadId) {
      try {
        const res = await api.post<{ thread_id: string }>(
          `/create-ai-chat?message=${encodeURIComponent(msg)}`
        );
        const newId = res.data.thread_id;
        setThreads((prev) => [
          { id: newId, name: "New Chat", created_at: new Date().toISOString() },
          ...prev,
        ]);
        setActiveThreadId(newId);
        setPanelView("chat");
        setMessages([{ id: `user-${Date.now()}`, role: "user", content: msg }]);
        await streamMessage(newId, msg);
      } catch (err) { console.error("Failed to create chat:", err); }
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", content: msg },
      ]);
      await streamMessage(activeThreadId, msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const backToThreads = () => {
    setPanelView("threads");
    setActiveThreadId(null);
    setMessages([]);
    setStatusText(null);
    loadThreads();
  };

  const openRenameView = (thread: Thread) => {
    setRenameTarget(thread);
    setRenameDraft(thread.name);
  };

  const openDeleteView = (thread: Thread) => {
    setDeleteTarget(thread);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const newName = renameDraft.trim();
    if (!newName || newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    setThreadActionLoading((prev) => ({ ...prev, [renameTarget.id]: true }));
    try {
      await api.post(`/rename-chat-session/${renameTarget.id}`, null, {
        params: { new_name: newName },
      });
      setThreads((prev) => prev.map((t) => (t.id === renameTarget.id ? { ...t, name: newName } : t)));
      setRenameTarget(null);
    } catch (err) {
      console.error("Failed to rename chat session:", err);
    } finally {
      setThreadActionLoading((prev) => ({ ...prev, [renameTarget.id]: false }));
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;

    setThreadActionLoading((prev) => ({ ...prev, [deleteTarget.id]: true }));
    try {
      await api.post(`/delete-chat-session/${deleteTarget.id}`);
      setThreads((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (activeThreadId === deleteTarget.id) {
        setPanelView("threads");
        setActiveThreadId(null);
        setMessages([]);
        setStatusText(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    } finally {
      setThreadActionLoading((prev) => ({ ...prev, [deleteTarget.id]: false }));
    }
  };

  const viewSnapshot = async (msg: Message) => {
    if (msg.canvas_data) {
      const payload = msg.canvas_data;
      const rows: Record<string, unknown>[] = Array.isArray(payload)
        ? payload
        : ((payload as { rows?: Record<string, unknown>[] }).rows ?? []);
      const columns: string[] =
        (payload as { columns?: string[] }).columns ??
        (rows.length > 0 ? Object.keys(rows[0]) : []);
      onCanvasData({ rows, columns });
      return;
    }

    if (msg.sql_query) {
      setLoadingCanvas(prev => ({ ...prev, [msg.id]: true }));
      try {
        const res = await api.post<{ results: Record<string, unknown>[] }>(`/execute-canvas-query`, {
          sql_query: msg.sql_query,
          sql_params: msg.sql_params || []
        });
        const rows = res.data.results || [];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        onCanvasData({ rows, columns });
      } catch (err) {
        console.error("Failed to execute canvas query:", err);
      } finally {
        setLoadingCanvas(prev => ({ ...prev, [msg.id]: false }));
      }
    }
  };

  if (!isOpen) return null;

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div
      className="relative h-full bg-surface border-l border-outline-variant flex flex-col shrink-0 slide-in-right overflow-hidden"
      style={{ width: `${panelWidth}px` }}
    >
      <div
        role="separator"
        aria-label="Resize AI chat panel"
        aria-orientation="vertical"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizingPanel(true);
        }}
        className={`absolute left-0 top-0 bottom-0 w-1 -translate-x-1/2 cursor-col-resize z-30 transition-colors ${isResizingPanel ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"}`}
      />

      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-outline-variant flex items-center justify-between shrink-0 bg-surface">
        {panelView === "chat" ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={backToThreads}
              className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-on-surface truncate thread-name-animate">
              {activeThread?.name ?? "New Chat"}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-on-surface">AI Assistant</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {panelView === "chat" && activeThread && (
            <>
              <button
                onClick={() => openRenameView(activeThread)}
                disabled={threadActionLoading[activeThread.id]}
                className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors disabled:opacity-40"
                title="Rename chat"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openDeleteView(activeThread)}
                disabled={threadActionLoading[activeThread.id]}
                className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                title="Delete chat"
              >
                {threadActionLoading[activeThread.id] ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
          {panelView === "threads" && (
            <button
              onClick={() => { setPanelView("chat"); setActiveThreadId(null); setMessages([]); }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {panelView === "threads" ? (
        <ThreadList
          threads={threads}
          loading={loadingThreads}
          onOpen={openThread}
          onRename={openRenameView}
          onDelete={openDeleteView}
          actionLoading={threadActionLoading}
          onNewChat={() => { setPanelView("chat"); setActiveThreadId(null); setMessages([]); }}
        />
      ) : (
        <ChatView
          messages={messages}
          loading={loadingMessages}
          isStreaming={isStreaming}
          statusText={statusText}
          loadingCanvas={loadingCanvas}
          inputValue={inputValue}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          onInputChange={setInputValue}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          onViewSnapshot={viewSnapshot}
        />
      )}

      {renameTarget && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-[320px] rounded-xl border border-outline-variant bg-surface p-4 shadow-xl">
            <p className="text-sm font-semibold text-on-surface mb-2">Rename Chat</p>
            <input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Enter chat name"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                onClick={submitRename}
                disabled={threadActionLoading[renameTarget.id]}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
              >
                {threadActionLoading[renameTarget.id] ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-[320px] rounded-xl border border-outline-variant bg-surface p-4 shadow-xl">
            <p className="text-sm font-semibold text-on-surface">Delete Chat</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Are you sure you want to delete "{deleteTarget.name}"? This cannot be undone.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                onClick={submitDelete}
                disabled={threadActionLoading[deleteTarget.id]}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              >
                {threadActionLoading[deleteTarget.id] ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thread list ───────────────────────────────────────────────────────────────

function ThreadList({
  threads, loading, onOpen, onRename, onDelete, actionLoading, onNewChat,
}: {
  threads: Thread[];
  loading: boolean;
  onOpen: (t: Thread) => void;
  onRename: (t: Thread) => void;
  onDelete: (t: Thread) => void;
  actionLoading: Record<string, boolean>;
  onNewChat: () => void;
}) {
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );

  if (threads.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center mb-4">
        <MessageSquare className="w-7 h-7 text-outline" />
      </div>
      <p className="text-sm font-semibold text-on-surface mb-1">No conversations yet</p>
      <p className="text-xs text-on-surface-variant mb-4">Start a new chat to analyze your data with AI.</p>
      <button
        onClick={onNewChat}
        className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" /> New Chat
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onOpen(thread)}
          className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-container-highest transition-colors group flex items-start gap-3"
        >
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary/70" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-on-surface truncate group-hover:text-primary transition-colors">
              {thread.name}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {formatThreadDate(thread)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onRename(thread); }}
              disabled={actionLoading[thread.id]}
              className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors disabled:opacity-40"
              title="Rename chat"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(thread); }}
              disabled={actionLoading[thread.id]}
              className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
              title="Delete chat"
            >
              {actionLoading[thread.id] ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Chat view ─────────────────────────────────────────────────────────────────

function ChatView({
  messages, loading, isStreaming, statusText, loadingCanvas,
  inputValue, inputRef, messagesEndRef,
  onInputChange, onKeyDown, onSend, onViewSnapshot,
}: {
  messages: Message[];
  loading: boolean;
  isStreaming: boolean;
  statusText: string | null;
  loadingCanvas: Record<string, boolean>;
  inputValue: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onViewSnapshot: (msg: Message) => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-on-surface mb-1">What would you like to analyze?</p>
            <p className="text-xs text-on-surface-variant">Ask questions about your data, generate SQL, or explore trends.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} loadingCanvas={loadingCanvas[msg.id]} onViewCanvas={() => onViewSnapshot(msg)} />)
        )}

        {statusText && (
          <div className="flex justify-center py-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-[11px] text-primary font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              {statusText}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 pt-3 border-t border-outline-variant shrink-0">
        <div className="flex items-end gap-2 bg-surface-container-highest rounded-xl border border-outline-variant focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all p-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your data…"
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-60 leading-relaxed overflow-y-auto"
            style={{ minHeight: "22px", maxHeight: "128px" }}
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isStreaming}
            className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 shadow-sm"
          >
            {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-on-surface-variant/50 mt-1.5 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, loadingCanvas, onViewCanvas }: { message: Message; loadingCanvas?: boolean; onViewCanvas?: () => void }) {
  const [sqlExpanded, setSqlExpanded] = useState(false);

  const displayContent = message.content ? message.content.replace(/```sql[\s\S]*?```/gi, "").trim() : "";
  const sqlCode = message.content ? message.content.match(/```sql\n?([\s\S]*?)```/i)?.[1]?.trim() : message.sql_query;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-white text-sm leading-relaxed break-words">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "canvas") {
    const payload = message.canvas_data;
    let rowsCount = 0;
    let colsCount = 0;

    if (payload) {
      const rows = (Array.isArray(payload) ? payload : (payload.rows ?? [])) as unknown[];
      rowsCount = rows.length;
      colsCount = ((payload as any).columns?.length) ?? (rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>).length : 0);
    }

    return (
      <div className="flex flex-col gap-1.5 fade-up" style={{ animationDuration: "0.25s" }}>
        <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-surface-container border border-outline-variant px-3 py-3">
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Table2 className="w-2.5 h-2.5 text-primary" />
            </div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Data Canvas</span>
          </div>

          <button
            onClick={onViewCanvas}
            disabled={loadingCanvas}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-container-highest text-xs font-semibold text-on-surface hover:text-primary transition-colors rounded-xl border border-outline-variant hover:border-primary/30 group"
          >
            <div className="flex items-center gap-2 text-left min-w-0">
               <Database className="w-4 h-4 text-primary shrink-0" />
               <div className="min-w-0">
                 <span className="block truncate">Query Results</span>
                 {payload ? (
                   <span className="block text-[10px] text-on-surface-variant font-normal mt-0.5">{rowsCount.toLocaleString()} rows · {colsCount} columns</span>
                 ) : (
                   <span className="block text-[10px] text-on-surface-variant font-normal mt-0.5 truncate max-w-[200px]">{message.sql_query}</span>
                 )}
               </div>
            </div>
            <div className="shrink-0 text-primary">
               {loadingCanvas ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronLeft className="w-4 h-4 rotate-180 group-hover:translate-x-0.5 transition-transform" />}
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 fade-up" style={{ animationDuration: "0.25s" }}>
      <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-surface-container border border-outline-variant px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
          </div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">DataNexus AI</span>
        </div>

        <div className="text-sm text-on-surface leading-relaxed wrap-break-word">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0">{children}</ol>,
              li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {children}
                </a>
              ),
              code: ({ children, className }) => {
                const isBlock = Boolean(className);
                if (isBlock) {
                  return (
                    <code className="block rounded-md bg-surface px-2 py-2 text-xs font-mono overflow-x-auto border border-outline-variant">
                      {children}
                    </code>
                  );
                }

                return <code className="px-1 py-0.5 rounded bg-surface-container-highest text-xs font-mono">{children}</code>;
              },
              pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-outline pl-3 italic">{children}</blockquote>,
            }}
          >
            {displayContent || message.content || ""}
          </ReactMarkdown>
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-[15px] bg-primary/70 ml-0.5 rounded-sm cursor-blink align-middle" />
          )}
        </div>

        {sqlCode && (
          <div className="mt-3 rounded-lg border border-outline-variant overflow-hidden">
            <button
              onClick={() => setSqlExpanded((p) => !p)}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface-container-highest text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> SQL Query
              </div>
              {sqlExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {sqlExpanded && (
              <pre className="text-xs text-on-surface font-mono px-3 py-3 bg-surface overflow-x-auto leading-relaxed">
                <code>{sqlCode}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
