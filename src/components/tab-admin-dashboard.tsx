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
} from "lucide-react";
import { useToast } from "./toast";
import { formatDate } from "@/lib/utils";

interface UserItem {
  id: string;
  username: string;
  email: string | null;
  recovery_email: string | null;
  role: "admin" | "user";
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
    role: "user" as "user" | "admin",
    status: "active" as "active" | "suspended",
    maxMailboxes: 1,
  });
  const [showAddPassword, setShowAddPassword] = useState<boolean>(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    username: "",
    recoveryEmail: "",
    role: "user" as "user" | "admin",
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
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [activeMessageViewTab, setActiveMessageViewTab] = useState<"html" | "text" | "headers">("html");

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

  // Open Inspect User Emails Modal
  const openInspectModal = async (user: UserItem) => {
    setInspectingUser(user);
    setSelectedMailboxId("");
    setMessageSearch("");
    setUnreadOnly(false);
    setSelectedMessage(null);
    setActiveMessageViewTab("html");
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
            limit: "50",
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
          setSelectedMessage(items[0]);
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
              {(["all", "user", "admin"] as const).map((r) => (
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
                  {r === "all" ? "All" : r === "user" ? "User" : "Admin"}
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
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            User
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
                    onChange={(e) =>
                      setAddForm({ ...addForm, role: e.target.value as "user" | "admin" })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
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
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value as "user" | "admin" })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
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

      {/* MODAL 4: GIÁM SÁT & XEM TOÀN BỘ EMAIL CỦA USER */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-5xl h-[92vh] max-h-[850px] rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
                  {inspectingUser.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      User Inboxes: @{inspectingUser.username}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 capitalize">
                      {inspectingUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {inspectingUser.email || `${inspectingUser.username}@mailtion.com`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    fetchUserMailboxesAndMessages(
                      inspectingUser.id,
                      selectedMailboxId,
                      messageSearch,
                      unreadOnly
                    )
                  }
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Refresh messages"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingMessages ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setInspectingUser(null)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filter Sub-bar */}
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Search className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search messages (subject, sender, OTP)..."
                  value={messageSearch}
                  onChange={(e) => handleFilterInspector(selectedMailboxId, e.target.value, unreadOnly)}
                  className="w-full bg-transparent border-0 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Select Mailbox */}
                <select
                  value={selectedMailboxId}
                  onChange={(e) => handleFilterInspector(e.target.value, messageSearch, unreadOnly)}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium cursor-pointer"
                >
                  <option value="">All Mailboxes ({userMailboxes.length})</option>
                  {userMailboxes.map((mb) => (
                    <option key={mb.id} value={mb.id}>
                      {mb.address} {mb.is_primary ? "★ (Primary)" : ""} ({mb.message_count || 0})
                    </option>
                  ))}
                </select>

                {/* Unread toggle */}
                <button
                  onClick={() => handleFilterInspector(selectedMailboxId, messageSearch, !unreadOnly)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    unreadOnly
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  Unread only
                </button>
              </div>
            </div>

            {/* Modal Body: Master - Detail Split */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Messages List */}
              <div className="w-full sm:w-80 md:w-96 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 shrink-0">
                {loadingMessages ? (
                  <div className="p-8 text-center text-zinc-400">
                    <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                    <p className="text-xs">Loading messages...</p>
                  </div>
                ) : userMessages.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400">
                    <Mail className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-xs font-medium">No messages found</p>
                    <p className="text-[11px] text-zinc-500 mt-1">This user has not received any emails yet</p>
                  </div>
                ) : (
                  userMessages.map((msg) => {
                    const isSelected = selectedMessage?.id === msg.id;
                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedMessage(msg)}
                        className={`p-3.5 transition-colors cursor-pointer text-left relative ${
                          isSelected
                            ? "bg-purple-50/70 dark:bg-purple-950/30 border-l-4 border-purple-600"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                            {msg.from_name || msg.from_addr}
                          </span>
                          <span className="text-[10px] text-zinc-400 shrink-0">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>

                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate mb-1">
                          {msg.subject || "(No subject)"}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[160px]">
                            To: {msg.to_addr}
                          </span>

                          {msg.otp_code && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              OTP: {msg.otp_code}
                            </span>
                          )}

                          {msg.has_attachments === 1 && (
                            <Paperclip className="h-3 w-3 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Email Content View */}
              <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-zinc-900">
                {selectedMessage ? (
                  <div className="flex-1 flex flex-col p-5 overflow-y-auto">
                    {/* Header info */}
                    <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {selectedMessage.subject || "(No subject)"}
                        </h3>
                        <button
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                        <div>
                          <span className="text-zinc-400">From: </span>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {selectedMessage.from_name ? `${selectedMessage.from_name} <${selectedMessage.from_addr}>` : selectedMessage.from_addr}
                          </strong>
                        </div>
                        <div>
                          <span className="text-zinc-400">To: </span>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                            {selectedMessage.to_addr}
                          </strong>
                        </div>
                        <div>
                          <span className="text-zinc-400">Date: </span>
                          <span>{formatDate(selectedMessage.created_at)}</span>
                        </div>
                        {selectedMessage.otp_code && (
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">OTP Code: </span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              {selectedMessage.otp_code}
                            </span>
                            <button
                              onClick={() => handleCopy(selectedMessage.otp_code!)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                              title="Copy OTP"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content view tabs */}
                      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <button
                          onClick={() => setActiveMessageViewTab("html")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "html"
                              ? "bg-purple-600 text-white"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          HTML Preview
                        </button>
                        <button
                          onClick={() => setActiveMessageViewTab("text")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "text"
                              ? "bg-purple-600 text-white"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Plain Text
                        </button>
                        <button
                          onClick={() => setActiveMessageViewTab("headers")}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            activeMessageViewTab === "headers"
                              ? "bg-purple-600 text-white"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Headers
                        </button>
                      </div>
                    </div>

                    {/* Email Content Body */}
                    <div className="flex-1 mt-4">
                      {activeMessageViewTab === "html" && (
                        selectedMessage.body_html ? (
                          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white p-4 overflow-x-auto min-h-[300px]">
                            <iframe
                              title="Email HTML Preview"
                              sandbox="allow-same-origin"
                              srcDoc={selectedMessage.body_html}
                              className="w-full min-h-[400px] border-0"
                            />
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            {selectedMessage.body_text || "(Empty content)"}
                          </pre>
                        )
                      )}

                      {activeMessageViewTab === "text" && (
                        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                          {selectedMessage.body_text || "(No plain text content)"}
                        </pre>
                      )}

                      {activeMessageViewTab === "headers" && (
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                          {selectedMessage.raw_headers || "(No raw headers)"}
                        </pre>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400">
                    <Mail className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Select a message from the list to view its contents
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
