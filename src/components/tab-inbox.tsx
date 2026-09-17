"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  Search,
  Mail,
  Trash2,
  RefreshCw,
  Paperclip,
  ChevronLeft,
  Eye,
  EyeOff,
  Filter,
  X,
  AtSign,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "./toast";

/* ─────────────────────────── Types ─────────────────────────── */

interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  content?: string | null;
}

interface MessageDetail {
  id: string;
  mailbox_id: string;
  mailbox_name?: string | null;
  from_addr: string;
  from_name: string | null;
  to_addr: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  raw_headers: string | null;
  is_read: number;
  has_attachments: number;
  otp_code: string | null;
  created_at: string;
  mailbox_tag?: string;
  attachments?: Attachment[];
}

interface MailboxItem {
  id: string;
  name: string | null;
  address: string;
  local_part: string;
  tag: string | null;
  note: string | null;
  status: "active" | "paused" | "expired";
  message_count?: number;
  unread_count?: number;
}

interface TabInboxProps {
  initialFilterAddress?: string;
  onClearAddressFilter: () => void;
  refreshTrigger: number;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function Avatar({ name, addr }: { name: string | null; addr: string }) {
  const letter = (name || addr).charAt(0).toUpperCase();
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  const idx = addr.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[idx]}`}
    >
      {letter}
    </div>
  );
}

/* ═══════════════════════════ Component ═══════════════════════════ */

export function TabInbox({
  initialFilterAddress,
  onClearAddressFilter,
  refreshTrigger,
}: TabInboxProps) {
  const { toast } = useToast();

  // view state: "mailboxes" | "messages" | "detail"
  const [view, setView] = useState<"mailboxes" | "messages" | "detail">(
    initialFilterAddress ? "messages" : "mailboxes"
  );

  /* ── Mailbox list pane ── */
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<MailboxItem | null>(null);
  const [mbLoading, setMbLoading] = useState(false);
  const [mbSearch, setMbSearch] = useState("");

  /* ── Message list pane ── */
  const [messages, setMessages] = useState<MessageDetail[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  /* ── Detail pane ── */
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<"html" | "text" | "headers">("html");

  /* ══════════════ Fetch mailboxes ══════════════ */
  const fetchMailboxes = useCallback(async () => {
    setMbLoading(true);
    try {
      const res = await fetch("/api/v1/mailboxes?limit=100");
      const data = await res.json();
      if (res.ok) setMailboxes(data.items || []);
    } catch {
      toast("Không thể tải danh sách hộp thư", "error");
    } finally {
      setMbLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes, refreshTrigger]);

  /* ══════════════ Fetch messages ══════════════ */
  const fetchMessages = useCallback(
    async (mailboxAddress?: string) => {
      setMsgLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        const addr = mailboxAddress ?? selectedMailbox?.address ?? initialFilterAddress ?? "";
        if (addr) params.set("mailboxAddress", addr);
        if (msgSearch.trim()) params.set("search", msgSearch.trim());
        if (unreadOnly) params.set("unreadOnly", "true");

        const res = await fetch(`/api/v1/messages?${params.toString()}`);
        const data = await res.json();
        if (res.ok) setMessages(data.items || []);
      } catch {
        toast("Không thể tải email", "error");
      } finally {
        setMsgLoading(false);
      }
    },
    [selectedMailbox, initialFilterAddress, msgSearch, unreadOnly, toast]
  );

  /* ══════════════ Handle initialFilterAddress ══════════════ */
  useEffect(() => {
    if (initialFilterAddress) {
      setView("messages");
      setSelectedMailbox(null);
      setSelectedMessage(null);
      fetchMessages(initialFilterAddress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilterAddress]);

  useEffect(() => {
    if (view === "messages" || view === "detail") {
      fetchMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgSearch, unreadOnly, refreshTrigger]);

  /* ══════════════ Mailbox selection ══════════════ */
  const selectMailbox = (mb: MailboxItem) => {
    setSelectedMailbox(mb);
    setSelectedMessage(null);
    setView("messages");
    fetchMessages(mb.address);
  };

  /* ══════════════ Message detail ══════════════ */
  const openMessageDetail = async (msg: MessageDetail) => {
    try {
      const res = await fetch(`/api/v1/messages/${msg.id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedMessage(data);
        setActiveViewTab(data.body_html ? "html" : "text");
        setView("detail");
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_read: 1 } : m))
        );
      }
    } catch {
      toast("Lỗi khi mở thư", "error");
    }
  };

  const deleteSelectedMessage = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa email này?")) return;
    try {
      const res = await fetch(`/api/v1/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Đã xóa email");
        setSelectedMessage(null);
        setView("messages");
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      toast("Không thể xóa email", "error");
    }
  };

  const toggleReadStatus = async (id: string, currentRead: number) => {
    const nextRead = currentRead === 1 ? 0 : 1;
    try {
      await fetch(`/api/v1/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: nextRead }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_read: nextRead } : m))
      );
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, is_read: nextRead });
      }
      toast(nextRead === 1 ? "Đã đánh dấu là Đã đọc" : "Đã đánh dấu là Chưa đọc");
    } catch {
      toast("Lỗi cập nhật trạng thái", "error");
    }
  };



  /* ══════════════ Derived data ══════════════ */
  const filteredMailboxes = mailboxes.filter((mb) => {
    const q = mbSearch.toLowerCase();
    return (
      !q ||
      (mb.name || "").toLowerCase().includes(q) ||
      mb.address.toLowerCase().includes(q) ||
      (mb.tag || "").toLowerCase().includes(q)
    );
  });

  const activeMailboxAddress =
    selectedMailbox?.address ?? (initialFilterAddress || null);

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-3">
      {/* External mailbox filter banner */}
      {initialFilterAddress && (
        <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-blue-500" />
            <span>
              Đang xem hộp thư:{" "}
              <strong className="font-mono">{initialFilterAddress}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              onClearAddressFilter();
              setView("mailboxes");
              setSelectedMailbox(null);
              setSelectedMessage(null);
            }}
            className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 font-medium hover:bg-blue-500/30 transition-colors"
          >
            <X className="h-3 w-3" />
            <span>Xem tất cả</span>
          </button>
        </div>
      )}

      {/* ── 3-pane Gmail layout ── */}
      <div
        className={`flex rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden`}
        style={{ minHeight: "calc(100vh - 180px)" }}
      >
        {/* ════════════════════════════════════════
            PANE 1 — Mailbox sidebar
            (always visible on md+, hidden on mobile when view !== "mailboxes")
        ════════════════════════════════════════ */}
        <div
          className={`
            flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40
            ${view === "mailboxes" ? "flex w-full md:w-64 lg:w-72" : "hidden md:flex md:w-64 lg:w-72"}
          `}
        >
          {/* Mailbox pane header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-200">
              <Inbox className="h-4 w-4" />
              <span>Hộp thư</span>
            </div>
            <button
              onClick={fetchMailboxes}
              title="Làm mới"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${mbLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Mailbox search */}
          <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={mbSearch}
                onChange={(e) => setMbSearch(e.target.value)}
                placeholder="Tìm hộp thư..."
                className="w-full rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
          </div>

          {/* All mail shortcut */}
          {!initialFilterAddress && (
            <button
              onClick={() => {
                setSelectedMailbox(null);
                setSelectedMessage(null);
                setView("mailboxes");
              }}
              className={`flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                view === "mailboxes" && !selectedMailbox
                  ? "bg-zinc-200/70 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Tất cả hộp thư</span>
              <span className="ml-auto text-xs text-zinc-400">{mailboxes.length}</span>
            </button>
          )}

          {/* Mailbox list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {mbLoading && mailboxes.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">Đang tải...</div>
            ) : filteredMailboxes.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">Không có hộp thư</div>
            ) : (
              filteredMailboxes.map((mb) => {
                const isActive = selectedMailbox?.id === mb.id ||
                  (initialFilterAddress && mb.address === initialFilterAddress);
                return (
                  <button
                    key={mb.id}
                    onClick={() => selectMailbox(mb)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-zinc-200/80 dark:bg-zinc-800 font-semibold"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      <AtSign className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {mb.name || mb.local_part}
                        </span>
                        {mb.tag && (
                          <span className="shrink-0 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            #{mb.tag}
                          </span>
                        )}
                      </div>
                      <span className="block truncate font-mono text-[11px] text-zinc-400">
                        {mb.address}
                      </span>
                    </div>
                    {(mb.unread_count ?? 0) > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {mb.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            PANE 2 — Message list
        ════════════════════════════════════════ */}
        {(view === "messages" || view === "detail") && (
          <div
            className={`
              flex flex-col border-r border-zinc-200 dark:border-zinc-800
              ${view === "detail" ? "hidden lg:flex lg:w-80 xl:w-96" : "flex flex-1 md:w-auto"}
            `}
          >
            {/* Message list header */}
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3.5">
              {/* Back to mailboxes on mobile */}
              <button
                onClick={() => {
                  setView("mailboxes");
                  setSelectedMailbox(null);
                  setSelectedMessage(null);
                }}
                className="mr-1 flex items-center gap-1 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {initialFilterAddress
                    ? initialFilterAddress
                    : selectedMailbox
                    ? (selectedMailbox.name || selectedMailbox.local_part)
                    : "Tất cả thư"}
                </span>
              </div>
              <button
                onClick={() => fetchMessages()}
                title="Làm mới"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${msgLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Message list search + filter */}
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-3 py-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Tìm tiêu đề, người gửi..."
                  className="w-full rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
                />
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded"
                />
                Chưa đọc
              </label>
            </div>

            {/* Message rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {msgLoading && messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">Đang tải thư...</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                  <Mail className="h-8 w-8 mb-3 stroke-1 text-zinc-300 dark:text-zinc-700" />
                  <span className="text-xs">Không có thư nào</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const isUnread = msg.is_read === 0;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => openMessageDetail(msg)}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : isUnread
                          ? "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                          : "bg-zinc-50/50 dark:bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <Avatar name={msg.from_name} addr={msg.from_addr} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              isUnread
                                ? "font-bold text-zinc-900 dark:text-zinc-100"
                                : "font-medium text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {msg.from_name || msg.from_addr}
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-sm ${
                            isUnread
                              ? "font-semibold text-zinc-800 dark:text-zinc-200"
                              : "text-zinc-500 dark:text-zinc-500"
                          }`}
                        >
                          {msg.subject || "(Không có tiêu đề)"}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="truncate font-mono text-[11px] text-zinc-400">
                            → {msg.to_addr}
                          </span>
                          {msg.has_attachments === 1 && (
                            <Paperclip className="h-3 w-3 shrink-0 text-zinc-400" />
                          )}
                        </div>
                      </div>
                      {isUnread && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PANE 3 — Email detail
        ════════════════════════════════════════ */}
        {view === "detail" && selectedMessage ? (
          <div className="flex flex-1 flex-col min-w-0">
            {/* Detail header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {/* Back to message list (mobile/tablet) */}
                <button
                  onClick={() => {
                    setSelectedMessage(null);
                    setView("messages");
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 lg:hidden"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Quay lại
                </button>

                <h2 className="flex-1 text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                  {selectedMessage.subject || "(Không có tiêu đề)"}
                </h2>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() =>
                      toggleReadStatus(selectedMessage.id, selectedMessage.is_read)
                    }
                    title={selectedMessage.is_read === 1 ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    {selectedMessage.is_read === 1 ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteSelectedMessage(selectedMessage.id)}
                    title="Xóa email"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* From / To / Date row */}
              <div className="flex items-start gap-3">
                <Avatar name={selectedMessage.from_name} addr={selectedMessage.from_addr} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedMessage.from_name
                        ? `${selectedMessage.from_name}`
                        : selectedMessage.from_addr}
                    </span>
                    {selectedMessage.from_name && (
                      <span className="font-mono text-xs text-zinc-400">
                        &lt;{selectedMessage.from_addr}&gt;
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>Tới:</span>
                    {selectedMessage.mailbox_name && (
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {selectedMessage.mailbox_name}
                      </span>
                    )}
                    <span className="font-mono text-zinc-600 dark:text-zinc-300">
                      {selectedMessage.to_addr}
                    </span>
                    <span className="ml-auto text-zinc-400">{formatDate(selectedMessage.created_at)}</span>
                  </div>
                </div>
              </div>



              {/* View mode tabs */}
              <div className="flex items-center gap-1 border-b border-zinc-100 dark:border-zinc-800 -mb-4 pb-0">
                {selectedMessage.body_html && (
                  <button
                    onClick={() => setActiveViewTab("html")}
                    className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                      activeViewTab === "html"
                        ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Nội dung HTML
                  </button>
                )}
                <button
                  onClick={() => setActiveViewTab("text")}
                  className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                    activeViewTab === "text"
                      ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  Văn bản thuần
                </button>
                <button
                  onClick={() => setActiveViewTab("headers")}
                  className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
                    activeViewTab === "headers"
                      ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  Raw Headers
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-6">
              {activeViewTab === "html" && selectedMessage.body_html ? (
                <div className="w-full h-full min-h-[400px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden">
                  <iframe
                    title="Email Content"
                    sandbox="allow-same-origin"
                    srcDoc={selectedMessage.body_html}
                    className="w-full h-full min-h-[500px] border-none"
                  />
                </div>
              ) : activeViewTab === "text" ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {selectedMessage.body_text || "(Không có nội dung văn bản thuần)"}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {selectedMessage.raw_headers || "Chưa có thông tin headers."}
                </pre>
              )}
            </div>

            {/* Attachments */}
            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Tệp đính kèm ({selectedMessage.attachments.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMessage.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">
                        {att.filename}
                      </span>
                      <span className="text-zinc-400">
                        ({Math.round(att.size / 1024)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : view === "mailboxes" ? (
          /* ════════════════════════════════════════
              PANE "MAILBOXES" full view — shown on mobile
              when no mailbox selected yet
          ════════════════════════════════════════ */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-zinc-400 gap-3">
            <Inbox className="h-12 w-12 stroke-1 text-zinc-300 dark:text-zinc-700" />
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Chọn một hộp thư để xem email
            </span>
          </div>
        ) : view === "messages" ? (
          /* ════════════════════════════════════════
              No message selected yet (desktop right pane placeholder)
          ════════════════════════════════════════ */
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-zinc-400 gap-3">
            <Mail className="h-12 w-12 stroke-1 text-zinc-300 dark:text-zinc-700" />
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Chọn một email để đọc
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
