"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Copy,
  Check,
  KeyRound,
  Star,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ArrowLeft,
  MailOpen,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatDate, extractOtpCode, ensureLinksOpenInNewTab, formatPlainTextWithLinks } from "@/lib/utils";
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
  is_primary?: number;
  message_count?: number;
  unread_count?: number;
}

interface TabInboxProps {
  initialFilterAddress?: string;
  initialMailboxFilter?: string;
  onClearAddressFilter?: () => void;
  refreshTrigger: number;
  currentUser?: {
    id: string;
    username: string;
    role: string;
    email?: string;
    maxMailboxes?: number;
  } | null;
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function SenderAvatar({ name, addr }: { name: string | null; addr: string }) {
  const display = (name || addr || "?").trim();
  const letter = display.charAt(0).toUpperCase();
  const colors = [
    "bg-blue-600 text-white",
    "bg-purple-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-indigo-600 text-white",
    "bg-cyan-600 text-white",
    "bg-teal-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < addr.length; i++) {
    hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  return (
    <div
      className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 shadow-2xs select-none ${color}`}
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
  currentUser,
}: TabInboxProps) {
  const { toast } = useToast();
  const effectiveFilter = initialFilterAddress || initialMailboxFilter || "";

  // Workspace Fullscreen State
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Focus / Full Width Reading Mode
  const [isFocusReading, setIsFocusReading] = useState(false);

  // Handle ESC key for exiting fullscreen or focus reading mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFocusReading) {
          setIsFocusReading(false);
        } else if (isFullScreen) {
          setIsFullScreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocusReading, isFullScreen]);

  // Layout View State for mobile screens
  const [mobilePane, setMobilePane] = useState<"mailboxes" | "messages" | "detail">(
    effectiveFilter ? "messages" : "messages"
  );

  // Mailboxes State
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [totalMailboxes, setTotalMailboxes] = useState<number | null>(null);
  const [selectedMailbox, setSelectedMailbox] = useState<MailboxItem | null>(null);
  const [mbLoading, setMbLoading] = useState(false);
  const [mbSearch, setMbSearch] = useState("");

  // Messages State
  const [messages, setMessages] = useState<MessageDetail[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");

  // Quick Filter: all, unread, otp, files
  const [quickFilter, setQuickFilter] = useState<"all" | "unread" | "otp" | "files">("all");

  // Reading Pane tabs: html, text, headers
  const [activeMessageViewTab, setActiveMessageViewTab] = useState<"html" | "text" | "headers">("html");

  // Copy feedback states
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);

  // Extract OTP helper
  const getOtp = useCallback((msg: { otp_code?: string | null; subject?: string; body_text?: string | null }) => {
    if (msg.otp_code && /^[0-9]{4,8}$/.test(msg.otp_code.trim())) {
      return msg.otp_code.trim();
    }
    const textToScan = `${msg.subject || ""} ${msg.body_text || ""}`;
    const extracted = extractOtpCode(textToScan);
    return extracted ? extracted.replace(/\D/g, "") : null;
  }, []);

  const handleCopyOtp = (e: React.MouseEvent, otp: string) => {
    e.stopPropagation();
    const clean = otp.replace(/\D/g, "");
    if (!clean) return;
    navigator.clipboard.writeText(clean);
    setCopiedOtp(clean);
    toast(`Copied verification code: ${clean}`, "success");
    setTimeout(() => setCopiedOtp(null), 2500);
  };

  const handleCopySubject = (subject: string) => {
    if (!subject) return;
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    toast("Subject copied to clipboard", "success");
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  // Keyboard shortcut for Esc when in fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Lock body scroll when in fullscreen mode
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullScreen]);

  // Fetch mailboxes
  const fetchMailboxes = useCallback(async () => {
    setMbLoading(true);
    try {
      const res = await fetch("/api/v1/mailboxes?limit=100");
      const data = await res.json();
      if (res.ok) {
        const items = data.items || [];
        setMailboxes(items);
        setTotalMailboxes(typeof data.total === "number" ? data.total : items.length);
        if (effectiveFilter) {
          const match = items.find((m: MailboxItem) => m.address.toLowerCase() === effectiveFilter.toLowerCase());
          if (match) setSelectedMailbox(match);
        }
      }
    } catch {
      toast("Failed to load mailboxes", "error");
    } finally {
      setMbLoading(false);
    }
  }, [effectiveFilter, toast]);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes, refreshTrigger]);

  // Fetch messages
  const fetchMessages = useCallback(
    async (mailboxAddress?: string) => {
      setMsgLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "100");
        const addr = mailboxAddress !== undefined ? mailboxAddress : (selectedMailbox?.address || effectiveFilter || "");
        if (addr) params.set("mailboxAddress", addr);
        if (msgSearch.trim()) params.set("search", msgSearch.trim());
        if (quickFilter === "unread") params.set("unreadOnly", "true");

        const res = await fetch(`/api/v1/messages?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setMessages(data.items || []);
        }
      } catch {
        toast("Failed to load messages", "error");
      } finally {
        setMsgLoading(false);
      }
    },
    [selectedMailbox, effectiveFilter, msgSearch, quickFilter, toast]
  );

  useEffect(() => {
    if (effectiveFilter) {
      setMobilePane("messages");
      fetchMessages(effectiveFilter);
    }
  }, [effectiveFilter, fetchMessages]);

  useEffect(() => {
    fetchMessages();
  }, [msgSearch, quickFilter, refreshTrigger, fetchMessages]);

  // Select a mailbox filter
  const handleSelectMailbox = (mb: MailboxItem | null) => {
    setSelectedMailbox(mb);
    setSelectedMessage(null);
    setIsFocusReading(false);
    setMobilePane("messages");
    fetchMessages(mb ? mb.address : "");
  };

  // Open & read message
  const handleSelectMessage = async (msg: MessageDetail) => {
    setSelectedMessage(msg);
    setMobilePane("detail");
    setActiveMessageViewTab(msg.body_html ? "html" : "text");

    if (msg.is_read === 0) {
      toggleReadStatus(msg.id, 0);
    }

    // Fetch full message details (including attachments)
    try {
      const res = await fetch(`/api/v1/messages/${msg.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedMessage(full);
        if (full.body_html) setActiveMessageViewTab("html");
        else setActiveMessageViewTab("text");
      }
    } catch {
      // Fallback to existing preview
    }
  };

  // Delete message
  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this email?")) return;
    try {
      const res = await fetch(`/api/v1/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Email deleted", "success");
        setSelectedMessage(null);
        setIsFocusReading(false);
        setMobilePane("messages");
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      toast("Could not delete email", "error");
    }
  };

  // Toggle read/unread
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
    } catch {
      toast("Failed to update status", "error");
    }
  };

  // Filtered mailboxes
  const filteredMailboxes = useMemo(() => {
    return mailboxes.filter((mb) => {
      const q = mbSearch.toLowerCase();
      return (
        mb.address.toLowerCase().includes(q) ||
        (mb.name && mb.name.toLowerCase().includes(q)) ||
        (mb.tag && mb.tag.toLowerCase().includes(q))
      );
    });
  }, [mailboxes, mbSearch]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (quickFilter === "unread" && msg.is_read !== 0) return false;
      if (quickFilter === "otp" && !getOtp(msg)) return false;
      if (quickFilter === "files" && msg.has_attachments !== 1) return false;
      if (msgSearch.trim()) {
        const q = msgSearch.toLowerCase();
        const subject = (msg.subject || "").toLowerCase();
        const from = (msg.from_name || msg.from_addr || "").toLowerCase();
        const to = (msg.to_addr || "").toLowerCase();
        return subject.includes(q) || from.includes(q) || to.includes(q);
      }
      return true;
    });
  }, [messages, quickFilter, msgSearch, getOtp]);

  const selectedOtp = selectedMessage ? getOtp(selectedMessage) : null;
  const isMulti = currentUser?.role === "multi" || (currentUser?.maxMailboxes !== undefined && currentUser.maxMailboxes > 1);
  const maxQuota = currentUser?.role === "admin" ? 999999 : (isMulti ? Math.max(100, currentUser?.maxMailboxes || 100) : (currentUser?.maxMailboxes ?? 1));
  const currentMailboxCount = totalMailboxes ?? mailboxes.length;

  // Workspace container styling based on fullscreen mode
  const containerClasses = isFullScreen
    ? "fixed inset-0 z-50 bg-zinc-100 dark:bg-zinc-950 flex flex-col overflow-hidden animate-in fade-in duration-150"
    : "flex flex-col h-[calc(100vh-80px)] min-h-[780px] lg:min-h-[880px] w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 shadow-xl overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isFullScreen ? (
            <button
              onClick={() => setIsFullScreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0"
              title="Exit fullscreen workspace"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
                <Mail className="h-4 w-4" />
              </div>
              <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 hidden sm:inline">
                Mail Workspace
              </h1>
            </div>
          )}

          {/* Mailbox Info Badges */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Mailbox count badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60 shrink-0">
              <Layers className="h-3 w-3" />
              <span>{mailboxes.length} {mailboxes.length === 1 ? "Mailbox" : "Mailboxes"}</span>
            </span>

            {/* Total messages badge */}
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shrink-0">
              <MailOpen className="h-3 w-3 text-zinc-400" />
              <span>{messages.length} Messages</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* External active filter notice */}
          {effectiveFilter && onClearAddressFilter && (
            <button
              onClick={() => {
                onClearAddressFilter();
                handleSelectMailbox(null);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
              title="Clear mailbox filter"
            >
              <Filter className="h-3 w-3" />
              <span className="hidden sm:inline">Clear Filter</span>
              <X className="h-3 w-3 ml-0.5" />
            </button>
          )}

          <button
            onClick={() => {
              fetchMailboxes();
              fetchMessages();
              toast("Mailbox refreshed", "success");
            }}
            title="Refresh mailboxes & messages"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${msgLoading || mbLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
            title={isFullScreen ? "Exit Fullscreen (ESC)" : "Expand to Fullscreen Workspace"}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
                <kbd className="hidden lg:inline px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] text-zinc-500">ESC</kbd>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= PANEL 1: Mailboxes Sidebar ================= */}
        <aside
          className={`
            w-full md:w-64 lg:w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0
            ${isFocusReading ? "hidden" : mobilePane === "mailboxes" ? "flex" : "hidden md:flex"}
          `}
        >
          {/* Sidebar Search */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search mailboxes..."
                value={mbSearch}
                onChange={(e) => setMbSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Mailbox List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* All Inboxes Button */}
            <button
              onClick={() => handleSelectMailbox(null)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedMailbox === null
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Inbox className="h-4 w-4 shrink-0" />
                <span className="truncate">All Inboxes</span>
              </div>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  selectedMailbox === null
                    ? "bg-blue-700 text-white"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {messages.length}
              </span>
            </button>

            {/* Divider */}
            <div className="pt-2 pb-1 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Mailbox Aliases</span>
              <span>{filteredMailboxes.length}</span>
            </div>

            {mbLoading && mailboxes.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">Loading mailboxes...</div>
            ) : filteredMailboxes.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">No mailboxes found</div>
            ) : (
              filteredMailboxes.map((mb) => {
                const isSelected = selectedMailbox?.id === mb.id;
                const isPrimary = mb.is_primary === 1;
                return (
                  <button
                    key={mb.id}
                    onClick={() => handleSelectMailbox(mb)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer group flex flex-col gap-1 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isPrimary && (
                          <span
                            title="Primary account mailbox"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold shrink-0"
                          >
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                            <span>Primary</span>
                          </span>
                        )}
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {mb.name || mb.local_part}
                        </span>
                      </div>

                      {(mb.unread_count ?? 0) > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0">
                          {mb.unread_count}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono truncate">
                      <span className="truncate">{mb.address}</span>
                      {mb.tag && (
                        <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 font-sans font-medium shrink-0">
                          #{mb.tag}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Mailbox Quota Bar at Bottom */}
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            {isMulti ? (
              <>
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span>Mailboxes Used</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                      Multi
                    </span>
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                    {currentMailboxCount} / {maxQuota}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (currentMailboxCount / Math.max(1, maxQuota)) * 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-medium">Account Plan</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Standard (1 Primary Mail)
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* ================= PANEL 2: Message List ================= */}
        <section
          className={`
            w-full md:w-80 lg:w-96 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0
            ${isFocusReading ? "hidden" : mobilePane === "messages" ? "flex" : "hidden md:flex"}
          `}
        >
          {/* Message List Controls */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobilePane("mailboxes")}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedMailbox ? selectedMailbox.address : "All Messages"}
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-medium font-mono">
                {filteredMessages.length} emails
              </span>
            </div>

            {/* Search messages */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search subject or sender..."
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setQuickFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                  quickFilter === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setQuickFilter("unread")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 ${
                  quickFilter === "unread"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setQuickFilter("otp")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1 ${
                  quickFilter === "otp"
                    ? "bg-amber-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <KeyRound className="h-3 w-3" />
                <span>With OTP</span>
              </button>
              <button
                onClick={() => setQuickFilter("files")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1 ${
                  quickFilter === "files"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Paperclip className="h-3 w-3" />
                <span>Files</span>
              </button>
            </div>
          </div>

          {/* Message List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {msgLoading && messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">Loading messages...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">
                <Mail className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                <span>No messages found</span>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const isUnread = msg.is_read === 0;
                const otp = getOtp(msg);

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-3.5 transition-all cursor-pointer relative group flex items-start gap-3 ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40"
                        : isUnread
                        ? "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                        : "bg-zinc-50/40 dark:bg-zinc-900/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    {/* Unread indicator */}
                    {isUnread && (
                      <span className="absolute left-1 top-4 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                    )}

                    <SenderAvatar name={msg.from_name} addr={msg.from_addr} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs truncate ${
                            isUnread
                              ? "font-bold text-zinc-900 dark:text-zinc-100"
                              : "font-medium text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {msg.from_name || msg.from_addr}
                        </span>
                        <span className="text-[11px] text-zinc-400 whitespace-nowrap font-mono shrink-0">
                          {formatRelativeTime(msg.created_at)}
                        </span>
                      </div>

                      <div
                        className={`text-xs mt-0.5 truncate ${
                          isUnread
                            ? "font-bold text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {msg.subject || "(No subject)"}
                      </div>

                      {/* Recipient badge */}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono truncate">
                        <span>&rarr; {msg.to_addr}</span>
                        {msg.has_attachments === 1 && (
                          <Paperclip className="h-3 w-3 text-purple-500 shrink-0 ml-auto" />
                        )}
                      </div>

                      {/* Direct 1-click OTP copy badge */}
                      {otp && (
                        <div className="mt-2 flex items-center">
                          <button
                            type="button"
                            onClick={(e) => handleCopyOtp(e, otp)}
                            title="Click to copy OTP code"
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[11px] font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                          >
                            <span className="text-[9px] uppercase font-sans font-bold text-amber-600 dark:text-amber-400">OTP</span>
                            <span className="tracking-wider">{otp}</span>
                            {copiedOtp === otp ? (
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-amber-700 dark:text-amber-300 shrink-0" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ================= PANEL 3: Reading Pane ================= */}
        <main
          className={`
            flex-1 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col min-w-0 overflow-hidden
            ${mobilePane === "detail" ? "flex" : "hidden md:flex"}
          `}
        >
          {selectedMessage ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Detail Header & Action Bar */}
              <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <button
                      onClick={() => {
                        if (isFocusReading) {
                          setIsFocusReading(false);
                        } else {
                          setMobilePane("messages");
                        }
                      }}
                      className={`p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 mt-0.5 cursor-pointer ${
                        isFocusReading ? "flex" : "md:hidden"
                      }`}
                      title={isFocusReading ? "Exit focus view" : "Back to messages"}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {isFocusReading && (
                      <button
                        onClick={() => setIsFocusReading(false)}
                        className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shrink-0 cursor-pointer"
                        title="Back to multi-column view"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Split View</span>
                      </button>
                    )}
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug break-words">
                      {selectedMessage.subject || "(No subject)"}
                    </h2>
                  </div>

                  {/* Actions: Full Width Focus, Open New Tab, Copy, Read/Unread, Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Full Width Reading Mode Toggle */}
                    <button
                      onClick={() => setIsFocusReading((prev) => !prev)}
                      title={isFocusReading ? "Exit full width reading (Restore columns)" : "Expand email to full width (Focus mode)"}
                      className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer hidden md:inline-flex items-center gap-1.5 text-xs font-medium ${
                        isFocusReading
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {isFocusReading ? (
                        <>
                          <Minimize2 className="h-3.5 w-3.5" />
                          <span>Exit Focus</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>Full Width</span>
                        </>
                      )}
                    </button>

                    {/* Open in new browser tab */}
                    <button
                      onClick={() => {
                        if (!selectedMessage) return;
                        const win = window.open("", "_blank");
                        if (win) {
                          const content = selectedMessage.body_html
                            ? ensureLinksOpenInNewTab(selectedMessage.body_html)
                            : `<pre style="font-family:sans-serif;white-space:pre-wrap;padding:24px;">${selectedMessage.body_text || ""}</pre>`;
                          win.document.write(`<!DOCTYPE html><html><head><title>${(selectedMessage.subject || "Email").replace(/</g, "&lt;")}</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;background:#f9fafb;">${content}</body></html>`);
                          win.document.close();
                        }
                      }}
                      title="Open email in new browser tab"
                      className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleCopySubject(selectedMessage.subject || "")}
                      title="Copy subject"
                      className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                    >
                      {copiedSubject ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => toggleReadStatus(selectedMessage.id, selectedMessage.is_read)}
                      title={selectedMessage.is_read === 1 ? "Mark as unread" : "Mark as read"}
                      className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {selectedMessage.is_read === 1 ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteMessage(selectedMessage.id)}
                      title="Delete email"
                      className="p-2 rounded-xl text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sender & Recipient Metadata Card */}
                <div className="px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SenderAvatar name={selectedMessage.from_name} addr={selectedMessage.from_addr} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                          {selectedMessage.from_name || selectedMessage.from_addr}
                        </span>
                        {selectedMessage.from_name && (
                          <span className="text-[11px] sm:text-xs text-zinc-400 font-mono">
                            &lt;{selectedMessage.from_addr}&gt;
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5 truncate">
                        <span>To:</span>
                        <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {selectedMessage.to_addr}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                    {formatDate(selectedMessage.created_at)}
                  </span>
                </div>

                {/* Dedicated OTP Callout Card */}
                {selectedOtp && (
                  <div className="p-3.5 sm:p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-gradient-to-r from-amber-50 via-amber-50/60 to-amber-50 dark:from-amber-950/40 dark:via-zinc-900/60 dark:to-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Security Verification Code
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-widest text-amber-900 dark:text-amber-200 select-all">
                          {selectedOtp}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopyOtp(e, selectedOtp)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedOtp === selectedOtp ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy OTP</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Attachments Section */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/40">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                      <Paperclip className="h-3.5 w-3.5 text-purple-500" />
                      <span>Attachments ({selectedMessage.attachments.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedMessage.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/v1/attachments/${att.id}`}
                          download={att.filename}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 text-xs text-zinc-700 dark:text-zinc-200 font-medium transition-all shadow-2xs"
                        >
                          <Download className="h-3.5 w-3.5 text-zinc-400 group-hover:text-purple-500" />
                          <span className="font-mono truncate max-w-[200px]">{att.filename}</span>
                          <span className="text-[10px] text-zinc-400">({formatSize(att.size)})</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content View Switcher Tabs */}
                <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <button
                    onClick={() => setActiveMessageViewTab("html")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeMessageViewTab === "html"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Rendered HTML
                  </button>
                  <button
                    onClick={() => setActiveMessageViewTab("text")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeMessageViewTab === "text"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Plain Text
                  </button>
                  <button
                    onClick={() => setActiveMessageViewTab("headers")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      activeMessageViewTab === "headers"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Raw Headers
                  </button>
                </div>
              </div>

              {/* Body Content Canvas */}
              <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex flex-col">
                {activeMessageViewTab === "html" && (
                  selectedMessage.body_html ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white p-4 overflow-x-auto min-h-[850px] lg:min-h-[950px] flex-1 flex flex-col shadow-xs">
                      <iframe
                        title="Email HTML Preview"
                        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={ensureLinksOpenInNewTab(selectedMessage.body_html)}
                        className="w-full min-h-[850px] lg:min-h-[950px] flex-1 border-0"
                      />
                    </div>
                  ) : (
                    <div
                      className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200 leading-relaxed min-h-[600px] flex-1 [&_a]:text-blue-600 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: formatPlainTextWithLinks(selectedMessage.body_text || "(Empty content)") }}
                    />
                  )
                )}

                {activeMessageViewTab === "text" && (
                  <div
                    className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap overflow-x-auto leading-relaxed min-h-[600px] flex-1 [&_a]:text-blue-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: formatPlainTextWithLinks(selectedMessage.body_text || "(No plain text content)") }}
                  />
                )}

                {activeMessageViewTab === "headers" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMessage.raw_headers || "");
                          toast("Raw headers copied to clipboard", "success");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Headers</span>
                      </button>
                    </div>
                    <pre className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                      {selectedMessage.raw_headers || "(No raw headers available)"}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Clean Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center mb-4 text-zinc-300 dark:text-zinc-600">
                <Mail className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                Select an email to view
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Choose a message from the list on the left to read its content, copy verification codes, or inspect attachments.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
