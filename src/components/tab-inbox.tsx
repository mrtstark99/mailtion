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
  Download,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { formatDate, extractOtpCode } from "@/lib/utils";
import { useToast } from "./toast";

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
  initialMailboxFilter?: string;
  onClearAddressFilter?: () => void;
  refreshTrigger: number;
}

function Avatar({ name, addr }: { name: string | null; addr: string }) {
  const letter = (name || addr).charAt(0).toUpperCase();
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  const idx = addr.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold text-white ${colors[idx]}`}
    >
      {letter}
    </div>
  );
}

export function TabInbox({
  initialFilterAddress,
  initialMailboxFilter,
  onClearAddressFilter,
  refreshTrigger,
}: TabInboxProps) {
  const { toast } = useToast();
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  const copyOtpToClipboard = (e: React.MouseEvent, otp: string) => {
    e.stopPropagation();
    const cleanDigits = otp.replace(/\D/g, "");
    if (!cleanDigits) return;
    navigator.clipboard.writeText(cleanDigits);
    toast(`Copied verification code: ${cleanDigits}`, "success");
    setTimeout(() => {
      setCopiedOtp(null);
    }, 2500);
  };

  const getOtp = (msg: { otp_code?: string | null; subject?: string; body_text?: string | null }) => {
    if (msg.otp_code && /^[0-9]{4,8}$/.test(msg.otp_code.trim())) {
      return msg.otp_code.trim();
    }
    const textToScan = `${msg.subject || ""} ${msg.body_text || ""}`;
    const extracted = extractOtpCode(textToScan);
    return extracted ? extracted.replace(/\D/g, "") : null;
  };
  const effectiveFilter = initialFilterAddress || initialMailboxFilter || "";

  const [view, setView] = useState<"mailboxes" | "messages" | "detail">(
    effectiveFilter ? "messages" : "mailboxes"
  );

  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<MailboxItem | null>(null);
  const [mbLoading, setMbLoading] = useState(false);
  const [mbSearch, setMbSearch] = useState("");

  const [messages, setMessages] = useState<MessageDetail[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [activeViewTab, setActiveViewTab] = useState<"html" | "text" | "headers">("html");

  const fetchMailboxes = useCallback(async () => {
    setMbLoading(true);
    try {
      const res = await fetch("/api/v1/mailboxes?limit=100");
      const data = await res.json();
      if (res.ok) setMailboxes(data.items || []);
    } catch {
      toast("Failed to load mailboxes", "error");
    } finally {
      setMbLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes, refreshTrigger]);

  const fetchMessages = useCallback(
    async (mailboxAddress?: string) => {
      setMsgLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        const addr = mailboxAddress ?? selectedMailbox?.address ?? effectiveFilter ?? "";
        if (addr) params.set("mailboxAddress", addr);
        if (msgSearch.trim()) params.set("search", msgSearch.trim());
        if (unreadOnly) params.set("unreadOnly", "true");

        const res = await fetch(`/api/v1/messages?${params.toString()}`);
        const data = await res.json();
        if (res.ok) setMessages(data.items || []);
      } catch {
        toast("Failed to load messages", "error");
      } finally {
        setMsgLoading(false);
      }
    },
    [selectedMailbox, effectiveFilter, msgSearch, unreadOnly, toast]
  );

  useEffect(() => {
    if (effectiveFilter) {
      setView("messages");
      setSelectedMailbox(null);
      setSelectedMessage(null);
      fetchMessages(effectiveFilter);
    }
  }, [effectiveFilter, fetchMessages]);

  useEffect(() => {
    if (view === "messages" || view === "detail") {
      fetchMessages();
    }
  }, [msgSearch, unreadOnly, refreshTrigger, fetchMessages, view]);

  const selectMailbox = (mb: MailboxItem) => {
    setSelectedMailbox(mb);
    setSelectedMessage(null);
    setView("messages");
    fetchMessages(mb.address);
  };

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
      toast("Failed to open email", "error");
    }
  };

  const deleteSelectedMessage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email?")) return;
    try {
      const res = await fetch(`/api/v1/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Email deleted");
        setSelectedMessage(null);
        setView("messages");
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      toast("Could not delete email", "error");
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
      toast(nextRead === 1 ? "Marked as read" : "Marked as unread");
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const filteredMailboxes = mailboxes.filter((mb) => {
    const q = mbSearch.toLowerCase();
    return (
      !q ||
      (mb.name || "").toLowerCase().includes(q) ||
      mb.address.toLowerCase().includes(q) ||
      (mb.tag || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* External mailbox filter banner */}
      {effectiveFilter && (
        <div className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-3.5 py-2 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-blue-500" />
            <span className="truncate">
              Filtering inbox for: <strong className="font-mono">{effectiveFilter}</strong>
            </span>
          </div>
          {onClearAddressFilter && (
            <button
              onClick={() => {
                onClearAddressFilter();
                setSelectedMailbox(null);
                fetchMessages("");
              }}
              className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-blue-500/20 transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      )}

      {/* Main 3-pane layout */}
      <div className="flex h-[calc(100vh-140px)] min-h-[500px] rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
        {/* PANE 1: Mailbox list */}
        <div
          className={`
            flex flex-col border-r border-zinc-200 dark:border-zinc-800
            ${view === "mailboxes" ? "flex flex-1 md:flex-none md:w-64 lg:w-72" : "hidden md:flex md:w-64 lg:w-72"}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-3.5 sm:px-4 py-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-zinc-500" />
              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                Mailboxes
              </span>
            </div>
            <button
              onClick={() => fetchMailboxes()}
              title="Refresh mailboxes"
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${mbLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Mailbox search */}
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={mbSearch}
                onChange={(e) => setMbSearch(e.target.value)}
                placeholder="Search mailboxes..."
                className="w-full rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>
          </div>

          {/* All mail shortcut */}
          {!effectiveFilter && (
            <button
              onClick={() => {
                setSelectedMailbox(null);
                setSelectedMessage(null);
                setView("mailboxes");
              }}
              className={`flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm transition-colors ${
                view === "mailboxes" && !selectedMailbox
                  ? "bg-zinc-200/70 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>All Mailboxes</span>
              <span className="ml-auto text-xs text-zinc-400">{mailboxes.length}</span>
            </button>
          )}

          {/* Mailbox list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {mbLoading && mailboxes.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">Loading...</div>
            ) : filteredMailboxes.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">No mailboxes found</div>
            ) : (
              filteredMailboxes.map((mb) => {
                const isActive = selectedMailbox?.id === mb.id ||
                  (effectiveFilter && mb.address === effectiveFilter);
                return (
                  <button
                    key={mb.id}
                    onClick={() => selectMailbox(mb)}
                    className={`w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-colors ${
                      isActive
                        ? "bg-zinc-200/80 dark:bg-zinc-800 font-semibold"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      <AtSign className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {mb.name || mb.local_part}
                        </span>
                        {mb.tag && (
                          <span className="shrink-0 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            #{mb.tag}
                          </span>
                        )}
                      </div>
                      <span className="block truncate font-mono text-[10px] sm:text-[11px] text-zinc-400">
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

        {/* PANE 2: Message list */}
        {(view === "messages" || view === "detail") && (
          <div
            className={`
              flex flex-col border-r border-zinc-200 dark:border-zinc-800
              ${view === "detail" ? "hidden lg:flex lg:w-80 xl:w-96" : "flex flex-1 md:w-auto"}
            `}
          >
            {/* Message list header */}
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-3.5 sm:px-4 py-3">
              <button
                onClick={() => {
                  setView("mailboxes");
                  setSelectedMailbox(null);
                  setSelectedMessage(null);
                }}
                className="mr-1 flex items-center gap-1 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Mailboxes</span>
              </button>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 truncate block">
                  {effectiveFilter
                    ? effectiveFilter
                    : selectedMailbox
                    ? (selectedMailbox.name || selectedMailbox.local_part)
                    : "All Messages"}
                </span>
              </div>
              <button
                onClick={() => fetchMessages()}
                title="Refresh messages"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${msgLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Message list search + filter */}
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-3 py-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Search subject, sender..."
                  className="w-full rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
                />
              </div>
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded"
                />
                Unread
              </label>
            </div>

            {/* Message rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {msgLoading && messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                  <Mail className="h-8 w-8 mb-3 stroke-1 text-zinc-300 dark:text-zinc-700" />
                  <span className="text-xs">No messages found</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const isUnread = msg.is_read === 0;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => openMessageDetail(msg)}
                      className={`flex cursor-pointer items-start gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-3 transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : isUnread
                          ? "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                          : "bg-zinc-50/50 dark:bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <Avatar name={msg.from_name} addr={msg.from_addr} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`truncate text-xs sm:text-sm ${
                              isUnread
                                ? "font-bold text-zinc-900 dark:text-zinc-100"
                                : "font-medium text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {msg.from_name || msg.from_addr}
                          </span>
                          <span className="shrink-0 text-[10px] sm:text-[11px] text-zinc-400">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-xs sm:text-sm ${
                            isUnread
                              ? "font-semibold text-zinc-800 dark:text-zinc-200"
                              : "text-zinc-500 dark:text-zinc-500"
                          }`}
                        >
                          {msg.subject || "(No subject)"}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="truncate font-mono text-[10px] sm:text-[11px] text-zinc-400">
                            &rarr; {msg.to_addr}
                          </span>
                          {msg.has_attachments === 1 && (
                            <Paperclip className="h-3 w-3 shrink-0 text-zinc-400" />
                          )}
                        </div>
                        {(() => {
                          const msgOtp = getOtp(msg);
                          if (!msgOtp) return null;
                          return (
                            <div className="mt-1.5 flex items-center">
                              <button
                                type="button"
                                onClick={(e) => copyOtpToClipboard(e, msgOtp)}
                                title="Click to copy OTP code"
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-[11px] font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-2xs"
                              >
                                <span className="text-[9px] uppercase font-sans font-semibold text-blue-500 dark:text-blue-400">OTP</span>
                                <span className="tracking-wider">{msgOtp}</span>
                                {copiedOtp === msgOtp ? (
                                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                )}
                              </button>
                            </div>
                          );
                        })()}
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

        {/* PANE 3: Email detail */}
        {view === "detail" && selectedMessage ? (
          <div className="flex flex-1 flex-col min-w-0">
            {/* Detail header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-3.5 sm:px-6 py-3 sm:py-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedMessage(null);
                      setView("messages");
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 lg:hidden shrink-0 mt-0.5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <h2 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug break-words">
                    {selectedMessage.subject || "(No subject)"}
                  </h2>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() =>
                      toggleReadStatus(selectedMessage.id, selectedMessage.is_read)
                    }
                    title={selectedMessage.is_read === 1 ? "Mark as unread" : "Mark as read"}
                    className="rounded-lg p-1.5 sm:p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    {selectedMessage.is_read === 1 ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteSelectedMessage(selectedMessage.id)}
                    title="Delete email"
                    className="rounded-lg p-1.5 sm:p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sender & Recipient info */}
              <div className="flex items-center gap-3">
                <Avatar name={selectedMessage.from_name} addr={selectedMessage.from_addr} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedMessage.from_name || selectedMessage.from_addr}
                    </span>
                    {selectedMessage.from_name && (
                      <span className="font-mono text-[11px] sm:text-xs text-zinc-400">
                        &lt;{selectedMessage.from_addr}&gt;
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500">
                    <span>To:</span>
                    {selectedMessage.mailbox_name && (
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] sm:text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {selectedMessage.mailbox_name}
                      </span>
                    )}
                    <span className="font-mono text-zinc-600 dark:text-zinc-300 truncate max-w-[180px] sm:max-w-none">
                      {selectedMessage.to_addr}
                    </span>
                    <span className="ml-auto text-zinc-400 text-[10px] sm:text-xs">{formatDate(selectedMessage.created_at)}</span>
                  </div>
                </div>
              </div>

              {(() => {
                const detailOtp = getOtp(selectedMessage);
                if (!detailOtp) return null;
                return (
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-blue-50 dark:border-blue-900/60 dark:from-blue-950/40 dark:via-zinc-900/60 dark:to-blue-950/30 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                          One-Time Verification Code (OTP)
                        </div>
                        <div className="text-2xl sm:text-3xl font-mono font-extrabold tracking-widest text-blue-700 dark:text-blue-300 select-all">
                          {detailOtp}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => copyOtpToClipboard(e, detailOtp)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                    >
                      {copiedOtp === detailOtp ? (
                        <>
                          <Check className="h-4 w-4 text-white" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy OTP Code</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* View mode tabs */}
              <div className="flex items-center gap-1 border-b border-zinc-100 dark:border-zinc-800 -mb-3 sm:-mb-4 pb-0 overflow-x-auto no-scrollbar">
                {selectedMessage.body_html && (
                  <button
                    onClick={() => setActiveViewTab("html")}
                    className={`border-b-2 px-3 sm:px-4 py-2 text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${
                      activeViewTab === "html"
                        ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    HTML Content
                  </button>
                )}
                <button
                  onClick={() => setActiveViewTab("text")}
                  className={`border-b-2 px-3 sm:px-4 py-2 text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${
                    activeViewTab === "text"
                      ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  Plain Text
                </button>
                <button
                  onClick={() => setActiveViewTab("headers")}
                  className={`border-b-2 px-3 sm:px-4 py-2 text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${
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
            <div className="flex-1 overflow-auto p-3.5 sm:p-6">
              {activeViewTab === "html" && selectedMessage.body_html ? (
                <div className="w-full h-full min-h-[350px] sm:min-h-[400px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden">
                  <iframe
                    title="Email Content"
                    sandbox="allow-same-origin"
                    srcDoc={selectedMessage.body_html}
                    className="w-full h-full min-h-[450px] sm:min-h-[500px] border-none"
                  />
                </div>
              ) : activeViewTab === "text" ? (
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed bg-zinc-50 dark:bg-zinc-950/60 p-3.5 sm:p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {selectedMessage.body_text || "(No plain text content)"}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 sm:p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                  {selectedMessage.raw_headers || "No header information available."}
                </pre>
              )}
            </div>

            {/* Attachments */}
            {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-3.5 sm:px-6 py-3 sm:py-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attachments ({selectedMessage.attachments.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {selectedMessage.attachments.map((att) => {
                    const isImage = att.content_type?.startsWith("image/");
                    const viewUrl = `/api/v1/attachments/${att.id}`;
                    const downloadUrl = `/api/v1/attachments/${att.id}?download=1`;

                    return (
                      <div
                        key={att.id}
                        className="flex flex-col rounded-lg border border-zinc-200 bg-white overflow-hidden text-xs dark:border-zinc-700 dark:bg-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                      >
                        {isImage && (
                          <div className="relative h-32 sm:h-36 w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-700/50 flex items-center justify-center overflow-hidden group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={viewUrl}
                              alt={att.filename}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white font-medium transition-opacity"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>View Full Size</span>
                            </a>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2 sm:p-2.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <div className="min-w-0">
                              <p
                                className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate font-medium max-w-[140px] sm:max-w-[200px]"
                                title={att.filename}
                              >
                                {att.filename}
                              </p>
                              <span className="text-[10px] sm:text-[11px] text-zinc-400">
                                {Math.round(att.size / 1024)} KB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={downloadUrl}
                              download={att.filename}
                              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
                              title="Download attachment"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty right pane on desktop */
          <div className="hidden lg:flex flex-1 items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-400 text-xs">
            Select a message from the list to view its contents
          </div>
        )}
      </div>
    </div>
  );
}

export default TabInbox;
