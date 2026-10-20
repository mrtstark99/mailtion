"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Mail,
  Inbox,
  Search,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  X,
  Check,
  Copy,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Clock,
  Sparkles,
  Paperclip,
  CheckCircle2,
  Filter,
  ArrowLeft,
  Download,
  KeyRound,
  MailOpen,
  Star,
  AtSign,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "./toast";
import { formatDate, formatFullDate, extractOtpCode, ensureLinksOpenInNewTab, formatPlainTextWithLinks } from "@/lib/utils";

interface AttachmentItem {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

interface UserItem {
  id: string;
  username: string;
  email: string | null;
  recovery_email: string | null;
  role: "admin" | "user" | "multi";
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
  mailbox_count: number;
  message_count: number;
  max_mailboxes?: number;
}

interface UserMailbox {
  id: string;
  address: string;
  local_part: string;
  domain: string;
  is_primary: number;
  status: string;
  message_count: number;
  unread_count: number;
}

interface UserMessage {
  id: string;
  mailbox_id: string;
  mailbox_name: string | null;
  mailbox_address: string;
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
  attachments?: AttachmentItem[];
}

function SenderAvatar({ name, addr }: { name: string | null; addr: string }) {
  const letter = (name || addr || "?").charAt(0).toUpperCase();
  const colors = [
    "bg-indigo-600 text-white",
    "bg-purple-600 text-white",
    "bg-blue-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-teal-600 text-white",
  ];
  const idx = (addr || "a").charCodeAt(0) % colors.length;
  return (
    <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs ${colors[idx]}`}>
      {letter}
    </div>
  );
}

function formatSize(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TabAdminDashboardProps {
  currentUserId?: string;
  onRefreshAll?: () => void;
}

export function TabAdminDashboard({ currentUserId, onRefreshAll }: TabAdminDashboardProps) {
  const { toast } = useToast();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [stats, setStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    adminUsers: number;
    totalUserMessages: number;
  }>({
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    adminUsers: 0,
    totalUserMessages: 0,
  });

  // Copied address tooltip
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [inspectingUser, setInspectingUser] = useState<UserItem | null>(null);

  // Add User Form State
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    recoveryEmail: "",
    role: "user" as "user" | "admin" | "multi",
    status: "active" as "active" | "suspended",
    maxMailboxes: 1,
  });
  const [showAddPassword, setShowAddPassword] = useState<boolean>(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    username: "",
    recoveryEmail: "",
    role: "user" as "user" | "admin" | "multi",
    status: "active" as "active" | "suspended",
    password: "",
    maxMailboxes: 1,
  });
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Toggle status loading ID
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // User Mail Inspector State
  const [userMailboxes, setUserMailboxes] = useState<UserMailbox[]>([]);
  const [userMessages, setUserMessages] = useState<UserMessage[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>("");
  const [messageSearch, setMessageSearch] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "unread" | "otp" | "attachments">("all");
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [activeMessageViewTab, setActiveMessageViewTab] = useState<"html" | "text" | "headers">("html");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [copiedHeaders, setCopiedHeaders] = useState<boolean>(false);
  const [isFetchingFullMessage, setIsFetchingFullMessage] = useState<boolean>(false);

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to load users", "error");
      }
    } catch {
      toast("Network error loading users", "error");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast(`Copied: ${text}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Toggle user status (Active <-> Suspended)
  const handleToggleStatus = async (user: UserItem) => {
    if (user.id === currentUserId) {
      toast("You cannot suspend your own account", "error");
      return;
    }
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/toggle-status`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message, "success");
        fetchUsers();
        if (onRefreshAll) onRefreshAll();
      } else {
        toast(data.error || "Failed to update status", "error");
      }
    } catch {
      toast("System error updating status", "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Add User handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.password) {
      toast("Please enter both username and password", "error");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "User created successfully", "success");
        setIsAddModalOpen(false);
        setAddForm({
          username: "",
          password: "",
          recoveryEmail: "",
          role: "user",
          status: "active",
          maxMailboxes: 1,
        });
        fetchUsers();
        if (onRefreshAll) onRefreshAll();
      } else {
        toast(data.error || "Failed to create user", "error");
      }
    } catch {
      toast("Network error creating user", "error");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit User Modal
  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      recoveryEmail: user.recovery_email || "",
      role: user.role,
      status: user.status,
      password: "",
      maxMailboxes: user.max_mailboxes || 1,
    });
  };

  // Submit Edit User
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "User updated successfully", "success");
        setEditingUser(null);
        fetchUsers();
        if (onRefreshAll) onRefreshAll();
      } else {
        toast(data.error || "Failed to update user", "error");
      }
    } catch {
      toast("Network error updating user", "error");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "User deleted successfully", "success");
        setDeletingUser(null);
        fetchUsers();
        if (onRefreshAll) onRefreshAll();
      } else {
        toast(data.error || "Failed to delete user", "error");
      }
    } catch {
      toast("Network error deleting user", "error");
    }
  };

  // Helper to extract OTP from message
  const getOtp = useCallback((msg: UserMessage) => {
    if (msg.otp_code && /^[0-9]{4,8}$/.test(msg.otp_code.trim())) {
      return msg.otp_code.trim();
    }
    const textToScan = `${msg.subject || ""} ${msg.body_text || ""}`;
    const extracted = extractOtpCode(textToScan);
    return extracted ? extracted.replace(/\D/g, "") : null;
  }, []);

  // Keyboard shortcut listener for Esc and body overflow lock
  useEffect(() => {
    if (!inspectingUser) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectingUser(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [inspectingUser]);

  // Open Inspect User Emails Fullscreen View
  const openInspectModal = async (user: UserItem) => {
    setInspectingUser(user);
    setSelectedMailboxId("");
    setMessageSearch("");
    setUnreadOnly(false);
    setQuickFilter("all");
    setSelectedMessage(null);
    setActiveMessageViewTab("html");
    setMobilePane("list");
    fetchUserMailboxesAndMessages(user.id);
  };

  const fetchUserMailboxesAndMessages = async (userId: string, mbId?: string, searchQ?: string, unread?: boolean) => {
    setLoadingMessages(true);
    try {
      const [mbRes, msgRes] = await Promise.all([
        fetch(`/api/v1/admin/users/${userId}/mailboxes`),
        fetch(
          `/api/v1/admin/users/${userId}/messages?${new URLSearchParams({
            mailboxId: mbId || "",
            search: searchQ || "",
            unread: unread ? "true" : "false",
            limit: "100",
          }).toString()}`
        ),
      ]);

      if (mbRes.ok) {
        const mbData = await mbRes.json();
        setUserMailboxes(mbData.items || []);
      }

      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const items = msgData.items || [];
        setUserMessages(items);
        if (items.length > 0 && !selectedMessage) {
          handleSelectMessage(items[0]);
        }
      }
    } catch {
      toast("Failed to load user mailboxes", "error");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleFilterInspector = (newMbId: string, newSearch: string, newUnread: boolean) => {
    if (!inspectingUser) return;
    setSelectedMailboxId(newMbId);
    setMessageSearch(newSearch);
    setUnreadOnly(newUnread);
    fetchUserMailboxesAndMessages(inspectingUser.id, newMbId, newSearch, newUnread);
  };

  // Select message and fetch attachments if present
  const handleSelectMessage = async (msg: UserMessage) => {
    setSelectedMessage(msg);
    setMobilePane("detail");

    if (msg.has_attachments === 1 && (!msg.attachments || msg.attachments.length === 0)) {
      setIsFetchingFullMessage(true);
      try {
        const res = await fetch(`/api/v1/messages/${msg.id}`);
        if (res.ok) {
          const fullMsg = await res.json();
          if (fullMsg.attachments) {
            setSelectedMessage((prev) => (prev?.id === msg.id ? { ...prev, attachments: fullMsg.attachments } : prev));
            setUserMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, attachments: fullMsg.attachments } : m)));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch full message attachments:", e);
      } finally {
        setIsFetchingFullMessage(false);
      }
    }
  };

  // Toggle read / unread status
  const handleToggleRead = async (msgId: string, currentRead: number) => {
    const newRead = currentRead === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/v1/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: newRead === 1 }),
      });
      if (res.ok) {
        setUserMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_read: newRead } : m)));
        if (selectedMessage?.id === msgId) {
          setSelectedMessage((prev) => (prev ? { ...prev, is_read: newRead } : null));
        }
        toast(newRead === 1 ? "Marked as read" : "Marked as unread", "success");
      }
    } catch {
      toast("Failed to update message status", "error");
    }
  };

  // Copy OTP code
  const handleCopyOtpCode = (e: React.MouseEvent, otp: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(otp);
    setCopiedOtp(otp);
    toast(`Copied OTP code: ${otp}`, "success");
    setTimeout(() => setCopiedOtp(null), 2500);
  };

  // Delete message inside inspector
  const handleDeleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/v1/messages/${msgId}`, { method: "DELETE" });
      if (res.ok) {
        toast("Message deleted successfully", "success");
        setUserMessages((prev) => prev.filter((m) => m.id !== msgId));
        if (selectedMessage?.id === msgId) {
          setSelectedMessage(null);
        }
        // Update user message counts locally & in table
        fetchUsers();
      } else {
        toast("Failed to delete message", "error");
      }
    } catch {
      toast("Error deleting message", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white p-6 rounded-2xl shadow-lg border border-zinc-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-400" />
            User Management
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-md hover:shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Users</span>
            <div className="rounded-lg p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {stats.totalUsers}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active</span>
            <div className="rounded-lg p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.activeUsers}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Suspended</span>
            <div className="rounded-lg p-2 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.suspendedUsers}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Admins</span>
            <div className="rounded-lg p-2 bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {stats.adminUsers}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 col-span-2 lg:col-span-1 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Messages</span>
            <div className="rounded-lg p-2 bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {stats.totalUserMessages}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search username, email, recovery email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 transition-all"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium">
              <span className="text-zinc-400 px-2 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Status:
              </span>
              {(["all", "active", "suspended"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer capitalize ${
                    statusFilter === s
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {s === "all" ? "All" : s === "active" ? "Active" : "Suspended"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium">
              <span className="text-zinc-400 px-2">Role:</span>
              {(["all", "user", "multi", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRoleFilter(r);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer capitalize ${
                    roleFilter === r
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {r === "all" ? "All" : r === "user" ? "Standard" : r === "multi" ? "Multi" : "Admin"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">User</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Recovery Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center hidden sm:table-cell">Mailboxes</th>
                <th className="py-3.5 px-4 text-center hidden sm:table-cell">Messages</th>
                <th className="py-3.5 px-4 hidden lg:table-cell">Created</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Users className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="font-medium">No users found</p>
                    <p className="text-xs text-zinc-400 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isSuspended = u.status === "suspended";

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSuspended ? "opacity-75 bg-amber-50/20 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 ring-2 ring-purple-500/20"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                            }`}
                          >
                            {u.username.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                @{u.username}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                              <span>{u.email || `${u.username}@mailtion.com`}</span>
                              <button
                                onClick={() => handleCopy(u.email || `${u.username}@mailtion.com`)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                                title="Copy email address"
                              >
                                {copiedText === (u.email || `${u.username}@mailtion.com`) ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Recovery Email */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-zinc-600 dark:text-zinc-300 text-xs">
                        {u.recovery_email ? (
                          <span>{u.recovery_email}</span>
                        ) : (
                          <span className="text-zinc-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </span>
                        ) : u.role === "multi" || (u.max_mailboxes && u.max_mailboxes > 1) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            <Sparkles className="h-3 w-3" /> Multi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            Standard
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Mailbox count */}
                      <td className="py-3.5 px-4 text-center hidden sm:table-cell">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Current mailboxes / Quota">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{u.mailbox_count || 1}</span>
                            <span className="text-zinc-400">/</span>
                            <span>{u.role === "admin" ? "∞" : (u.max_mailboxes || 1)}</span>
                          </span>
                          {u.role !== "admin" && (u.max_mailboxes || 1) > 1 && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                              Limit: {u.max_mailboxes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Message count */}
                      <td className="py-3.5 px-4 text-center hidden sm:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          {u.message_count || 0}
                        </span>
                      </td>

                      {/* Created at */}
                      <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Button: Inspect mail */}
                          <button
                            onClick={() => openInspectModal(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs"
                            title="Inspect inboxes and messages"
                          >
                            <Inbox className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">View Mail</span>
                          </button>

                          {/* Button: Suspend / Resume */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf || togglingId === u.id}
                            className={`p-1.5 rounded-lg border text-xs font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isSuspended
                                ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300"
                            }`}
                            title={
                              isSelf
                                ? "Cannot suspend own account"
                                : isSuspended
                                ? "Reactivate user"
                                : "Suspend user"
                            }
                          >
                            {togglingId === u.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isSuspended ? (
                              <Play className="h-3.5 w-3.5" />
                            ) : (
                              <Pause className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Button: Edit */}
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-all active:scale-95 cursor-pointer"
                            title="Edit user"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Button: Delete */}
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={isSelf}
                            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-red-300 bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? "Cannot delete own account" : "Delete user"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-850">
            <div>
              Page {page} of {totalPages} ({total} users)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD USER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Add User</h3>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. johndoe"
                    value={addForm.username}
                    onChange={(e) =>
                      setAddForm({ ...addForm, username: e.target.value.toLowerCase().trim() })
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
                {addForm.username && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                    Primary address:{" "}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      {addForm.username}@mailtion.com
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showAddPassword ? "text" : "password"}
                    required
                    placeholder="At least 6 characters"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Recovery Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={addForm.recoveryEmail}
                  onChange={(e) => setAddForm({ ...addForm, recoveryEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Role
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => {
                      const newRole = e.target.value as "user" | "multi" | "admin";
                      setAddForm({
                        ...addForm,
                        role: newRole,
                        maxMailboxes: newRole === "multi" ? 100 : (newRole === "admin" ? 999999 : 1),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="user">Standard User (1 Mailbox)</option>
                    <option value="multi">Multi User (100 Mailboxes)</option>
                    <option value="admin">Administrator (Unlimited)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) =>
                      setAddForm({ ...addForm, status: e.target.value as "active" | "suspended" })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {addForm.role !== "admin" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mailbox Quota
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={addForm.maxMailboxes}
                      onChange={(e) =>
                        setAddForm({ ...addForm, maxMailboxes: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-24 px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {addForm.maxMailboxes <= 1
                        ? "(Single mailbox)"
                        : `(Up to ${addForm.maxMailboxes} mailboxes)`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingAdd && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Edit @{editingUser.username}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value.toLowerCase().trim() })
                  }
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Recovery Email
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={editForm.recoveryEmail}
                  onChange={(e) => setEditForm({ ...editForm, recoveryEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    disabled={editingUser.id === currentUserId}
                    onChange={(e) => {
                      const newRole = e.target.value as "user" | "multi" | "admin";
                      setEditForm({
                        ...editForm,
                        role: newRole,
                        maxMailboxes: newRole === "multi" ? 100 : (newRole === "admin" ? 999999 : 1),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="user">Standard User (1 Mailbox)</option>
                    <option value="multi">Multi User (100 Mailboxes)</option>
                    <option value="admin">Administrator (Unlimited)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    disabled={editingUser.id === currentUserId}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as "active" | "suspended" })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {editForm.role !== "admin" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mailbox Quota
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={editForm.maxMailboxes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, maxMailboxes: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-24 px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {editForm.maxMailboxes <= 1
                        ? "(Single mailbox)"
                        : `(Up to ${editForm.maxMailboxes} mailboxes)`}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingEdit && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE USER */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-900/60 bg-white p-6 shadow-2xl dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/60">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Delete User</h3>
                <p className="text-xs text-red-600 dark:text-red-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
              Are you sure you want to delete user{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">@{deletingUser.username}</strong>? All associated mailboxes, messages, and attachments will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN USER MAIL INSPECTOR */}
      {inspectingUser && (() => {
        // Compute message counts & filtered lists
        const totalUnreadCount = userMessages.filter((m) => m.is_read === 0).length;
        const totalOtpCount = userMessages.filter((m) => Boolean(getOtp(m))).length;
        const totalAttachmentsCount = userMessages.filter((m) => m.has_attachments === 1).length;

        const filteredMessages = userMessages.filter((m) => {
          if (quickFilter === "unread" && m.is_read !== 0) return false;
          if (quickFilter === "otp" && !getOtp(m)) return false;
          if (quickFilter === "attachments" && m.has_attachments !== 1) return false;
          return true;
        });

        const activeMailbox = userMailboxes.find((mb) => mb.id === selectedMailboxId);
        const selectedOtp = selectedMessage ? getOtp(selectedMessage) : null;

        return (
          <div className="fixed inset-0 z-50 bg-zinc-100 dark:bg-zinc-950 flex flex-col overflow-hidden animate-in fade-in duration-150 text-zinc-900 dark:text-zinc-100">
            {/* Top Workspace Header */}
            <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
              {/* Left: Back button & User Identity */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setInspectingUser(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Back to User Management (Esc)"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Users</span>
                </button>

                <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block shrink-0" />

                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs">
                    {inspectingUser.username.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      @{inspectingUser.username}
                    </span>
                    <span className="text-zinc-400 hidden md:inline">/</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono hidden md:inline truncate max-w-[200px] lg:max-w-[280px]">
                      {inspectingUser.email || `${inspectingUser.username}@mailtion.com`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 capitalize shrink-0 hidden sm:inline-block">
                      {inspectingUser.role}
                    </span>
                    {inspectingUser.status === "suspended" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 shrink-0">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0 hidden lg:inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Counter, Refresh & Close */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden xl:inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <span>{userMailboxes.length} {userMailboxes.length === 1 ? "Mailbox" : "Mailboxes"}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>{userMessages.length} {userMessages.length === 1 ? "Message" : "Messages"}</span>
                  {totalUnreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                      {totalUnreadCount} new
                    </span>
                  )}
                </span>

                <button
                  onClick={() =>
                    fetchUserMailboxesAndMessages(
                      inspectingUser.id,
                      selectedMailboxId,
                      messageSearch,
                      unreadOnly
                    )
                  }
                  className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                  title="Refresh messages"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingMessages ? "animate-spin" : ""}`} />
                </button>

                <button
                  onClick={() => setInspectingUser(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                  <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">ESC</span>
                </button>
              </div>
            </header>

            {/* 3-Panel Fullscreen Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* PANEL 1: Mailboxes Sidebar */}
              <aside className="w-60 lg:w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col shrink-0 hidden md:flex">
                <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Mailboxes
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {userMailboxes.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {/* Item: All Inboxes */}
                  <button
                    onClick={() => handleFilterInspector("", messageSearch, unreadOnly)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                      selectedMailboxId === ""
                        ? "bg-purple-600 text-white font-semibold shadow-xs"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Inbox className={`h-4 w-4 shrink-0 ${selectedMailboxId === "" ? "text-white" : "text-purple-500"}`} />
                      <span className="truncate">All Inboxes</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {totalUnreadCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          selectedMailboxId === "" ? "bg-white text-purple-700" : "bg-blue-500 text-white"
                        }`}>
                          {totalUnreadCount}
                        </span>
                      )}
                      <span className={`text-[11px] ${selectedMailboxId === "" ? "text-purple-100" : "text-zinc-400"}`}>
                        {userMessages.length}
                      </span>
                    </div>
                  </button>

                  <div className="pt-2 pb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Account Inboxes
                  </div>

                  {userMailboxes.map((mb) => {
                    const isSelected = selectedMailboxId === mb.id;
                    return (
                      <button
                        key={mb.id}
                        onClick={() => handleFilterInspector(mb.id, messageSearch, unreadOnly)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "bg-purple-600 text-white font-semibold shadow-xs"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{mb.address}</span>
                            {mb.is_primary === 1 && (
                              <Star className={`h-3 w-3 shrink-0 ${isSelected ? "text-amber-200 fill-amber-200" : "text-amber-500 fill-amber-500"}`} />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {mb.unread_count > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                              isSelected ? "bg-white text-purple-700" : "bg-blue-500 text-white"
                            }`}>
                              {mb.unread_count}
                            </span>
                          )}
                          <span className={`text-[11px] ${isSelected ? "text-purple-100" : "text-zinc-400"}`}>
                            {mb.message_count || 0}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Quota status */}
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40">
                  <div className="flex items-center justify-between mb-1">
                    <span>Mailbox Quota:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                      {inspectingUser.role === "admin" ? "Unlimited (Admin)" : `${userMailboxes.length} / ${inspectingUser.max_mailboxes || 1}`}
                    </span>
                  </div>
                </div>
              </aside>

              {/* PANEL 2: Messages List */}
              <section
                className={`w-full md:w-80 lg:w-[400px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col shrink-0 ${
                  mobilePane === "detail" ? "hidden md:flex" : "flex"
                }`}
              >
                {/* Search & Filter Header */}
                <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search subject, sender, OTP..."
                      value={messageSearch}
                      onChange={(e) => handleFilterInspector(selectedMailboxId, e.target.value, unreadOnly)}
                      className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                    {messageSearch && (
                      <button
                        onClick={() => handleFilterInspector(selectedMailboxId, "", unreadOnly)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Quick Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    <button
                      onClick={() => setQuickFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        quickFilter === "all"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      All ({userMessages.length})
                    </button>
                    <button
                      onClick={() => setQuickFilter("unread")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        quickFilter === "unread"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      Unread ({totalUnreadCount})
                    </button>
                    <button
                      onClick={() => setQuickFilter("otp")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                        quickFilter === "otp"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>OTP ({totalOtpCount})</span>
                    </button>
                    <button
                      onClick={() => setQuickFilter("attachments")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                        quickFilter === "attachments"
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                    >
                      <Paperclip className="h-3 w-3" />
                      <span>Files ({totalAttachmentsCount})</span>
                    </button>
                  </div>
                </div>

                {/* Messages List Area */}
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/80">
                  {loadingMessages ? (
                    <div className="p-12 text-center text-zinc-400">
                      <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                      <p className="text-xs font-medium">Loading messages...</p>
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                      <Mail className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">No messages found</p>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {messageSearch ? "Try clearing search filter" : "This user has no emails matching this filter"}
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      const msgOtp = getOtp(msg);
                      const isUnread = msg.is_read === 0;

                      return (
                        <div
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg)}
                          className={`p-3.5 transition-all cursor-pointer text-left relative ${
                            isSelected
                              ? "bg-purple-50/80 dark:bg-purple-950/40 border-l-4 border-purple-600"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <SenderAvatar name={msg.from_name} addr={msg.from_addr} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className={`text-xs truncate ${isUnread ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                                  {msg.from_name || msg.from_addr}
                                </span>
                                <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                                  {formatDate(msg.created_at)}
                                </span>
                              </div>

                              <div className={`text-xs truncate mb-1 ${isUnread ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-normal text-zinc-600 dark:text-zinc-400"}`}>
                                {msg.subject || "(No subject)"}
                              </div>

                              <div className="text-[11px] text-zinc-400 truncate mb-2">
                                {msg.body_text ? msg.body_text.slice(0, 80).replace(/\s+/g, " ") : "(No plain text content)"}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isUnread && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    New
                                  </span>
                                )}

                                {msgOtp && (
                                  <span
                                    onClick={(e) => handleCopyOtpCode(e, msgOtp)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                                    title="Click to copy OTP"
                                  >
                                    <KeyRound className="h-2.5 w-2.5" />
                                    <span>OTP: {msgOtp}</span>
                                    {copiedOtp === msgOtp ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                                  </span>
                                )}

                                {msg.has_attachments === 1 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    <Paperclip className="h-2.5 w-2.5" />
                                    <span>File</span>
                                  </span>
                                )}

                                <span className="text-[10px] text-zinc-400 font-mono ml-auto truncate max-w-[120px]">
                                  To: {msg.to_addr}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* PANEL 3: Message Reading Pane */}
              <main
                className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden ${
                  mobilePane === "list" ? "hidden md:flex" : "flex"
                }`}
              >
                {selectedMessage ? (
                  <div className="flex-1 flex flex-col overflow-y-auto">
                    {/* Header Action Bar */}
                    <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10 shadow-2xs">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {/* Mobile Back Button */}
                          <button
                            onClick={() => setMobilePane("list")}
                            className="md:hidden flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-semibold mb-2 cursor-pointer"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>Back to message list</span>
                          </button>

                          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight break-words select-text">
                            {selectedMessage.subject || "(No subject)"}
                          </h2>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex items-center gap-1.5 shrink-0">
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
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                            title="Open email in new browser tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleToggleRead(selectedMessage.id, selectedMessage.is_read)}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                            title={selectedMessage.is_read === 1 ? "Mark as unread" : "Mark as read"}
                          >
                            {selectedMessage.is_read === 1 ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4 text-purple-500" />}
                          </button>

                          <button
                            onClick={() => handleCopy(selectedMessage.subject || "")}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                            title="Copy Subject"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteMessage(selectedMessage.id)}
                            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-zinc-400 transition-all cursor-pointer"
                            title="Delete message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Sender & Recipient Information */}
                      <div className="mt-4 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <SenderAvatar name={selectedMessage.from_name} addr={selectedMessage.from_addr} />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {selectedMessage.from_name ? `${selectedMessage.from_name} <${selectedMessage.from_addr}>` : selectedMessage.from_addr}
                            </div>
                            <div className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px] truncate">
                              To: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedMessage.to_addr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0 text-zinc-500 dark:text-zinc-400 text-[11px]">
                          <div>{formatFullDate(selectedMessage.created_at)}</div>
                          <div className="text-zinc-400 font-mono mt-0.5">({formatDate(selectedMessage.created_at)})</div>
                        </div>
                      </div>

                      {/* Prominent OTP Highlight Banner */}
                      {selectedOtp && (
                        <div className="mt-3 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-2xs">
                              <KeyRound className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                Verification Code (OTP Detected)
                              </div>
                              <div className="text-2xl font-bold tracking-widest font-mono text-emerald-950 dark:text-emerald-100 select-all">
                                {selectedOtp}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleCopyOtpCode(e, selectedOtp)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            {copiedOtp === selectedOtp ? (
                              <>
                                <Check className="h-4 w-4" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Attachments Section */}
                      {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                        <div className="mt-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/40">
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

                      {/* View Switcher Tabs */}
                      <div className="flex items-center gap-2 mt-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <button
                          onClick={() => setActiveMessageViewTab("html")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "html"
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Rendered HTML
                        </button>
                        <button
                          onClick={() => setActiveMessageViewTab("text")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "text"
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Plain Text
                        </button>
                        <button
                          onClick={() => setActiveMessageViewTab("headers")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "headers"
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Raw Headers
                        </button>
                      </div>
                    </div>

                    {/* Content Display Canvas */}
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
                            className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-sm whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200 min-h-[600px] flex-1 [&_a]:text-blue-600 [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: formatPlainTextWithLinks(selectedMessage.body_text || "(Empty content)") }}
                          />
                        )
                      )}

                      {activeMessageViewTab === "text" && (
                        <div
                          className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap overflow-x-auto min-h-[600px] flex-1 [&_a]:text-blue-600 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: formatPlainTextWithLinks(selectedMessage.body_text || "(No plain text content)") }}
                        />
                      )}

                      {activeMessageViewTab === "headers" && (
                        <div className="space-y-2 flex-1 flex flex-col">
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
                          <pre className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto min-h-[600px] flex-1">
                            {selectedMessage.raw_headers || "(No raw headers available)"}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                    <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 dark:text-zinc-600 mb-4 shadow-inner">
                      <Mail className="h-8 w-8" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      No message selected
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      Select an email from the list on the left to read its content, view OTP codes, and inspect attachments.
                    </p>
                  </div>
                )}
              </main>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
