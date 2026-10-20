"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Copy,
  Trash2,
  Power,
  Inbox,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  Plus,
  Edit2,
  X,
  Tag,
  Dices,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "./toast";

interface MailboxItem {
  id: string;
  name: string | null;
  address: string;
  local_part: string;
  domain: string;
  tag: string | null;
  note: string | null;
  status: "active" | "paused" | "expired";
  is_primary?: number;
  expires_at: string | null;
  created_at: string;
  message_count?: number;
  unread_count?: number;
}

interface TabMailboxesProps {
  onOpenInboxForMailbox: (address: string) => void;
  refreshTrigger: number;
  isAdmin?: boolean;
  maxMailboxes?: number;
}

export function TabMailboxes({
  onOpenInboxForMailbox,
  refreshTrigger,
  isAdmin = false,
  maxMailboxes = 1,
}: TabMailboxesProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<MailboxItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create single modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newLocal, setNewLocal] = useState<string>("");
  const [newTag, setNewTag] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Edit name modal state
  const [editingItem, setEditingItem] = useState<MailboxItem | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>("");
  const [editTagValue, setEditTagValue] = useState<string>("");
  const [editNoteValue, setEditNoteValue] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const fetchMailboxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (tagFilter) params.set("tag", tagFilter);

      const res = await fetch(`/api/v1/mailboxes?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      toast("Failed to load mailboxes", "error");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, tagFilter, toast]);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes, refreshTrigger]);

  const copyAddress = (address: string, id: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    toast(`Copied: ${address}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/v1/mailboxes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: nextStatus as "active" | "paused" } : item))
        );
        toast(`Mailbox status changed to ${nextStatus === "active" ? "Active" : "Paused"}`);
      } else {
        const data = await res.json();
        toast(data.error || "Could not update status", "error");
      }
    } catch {
      toast("Could not update status", "error");
    }
  };

  const deleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mailbox and all of its emails?")) return;
    try {
      const res = await fetch(`/api/v1/mailboxes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("Mailbox deleted");
        fetchMailboxes();
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        toast(data.error || "Failed to delete mailbox", "error");
      }
    } catch {
      toast("Failed to delete mailbox", "error");
    }
  };

  // Bulk Actions - exclude primary mailboxes
  const selectableItems = items.filter((i) => i.is_primary !== 1);

  const handleSelectAll = () => {
    if (selectedIds.length === selectableItems.length && selectableItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} selected mailboxes?`)) return;

    try {
      const res = await fetch("/api/v1/mailboxes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        toast(`Deleted selected mailboxes`);
        setSelectedIds([]);
        fetchMailboxes();
      }
    } catch {
      toast("Failed to delete selected mailboxes", "error");
    }
  };

  const handleBulkCopy = () => {
    const selectedAddresses = items
      .filter((i) => selectedIds.includes(i.id))
      .map((i) => i.address);
    if (selectedAddresses.length === 0) return;

    navigator.clipboard.writeText(selectedAddresses.join("\n"));
    toast(`Copied ${selectedAddresses.length} email addresses`);
  };

  const handleExportSelected = () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    const content = selectedItems.map((i) => `${i.name ? `[${i.name}] ` : ""}${i.address}`).join("\r\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mailtion_selected_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported to .txt file");
  };

  // Quick Single Creation Handler
  const maxLimit = isAdmin ? 999999 : (maxMailboxes || 1);
  const canCreateMultiple = isAdmin || maxLimit > 1;
  const isAtLimit = !isAdmin && total >= maxLimit;

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateMultiple) {
      toast("Tài khoản của bạn chưa được cấp quyền tạo thêm email.", "error");
      return;
    }
    if (isAtLimit) {
      toast(`Tài khoản của bạn đã đạt hạn mức tối đa (${maxLimit} email).`, "error");
      return;
    }
    setIsCreating(true);
    try {
      let local = newLocal.trim().replace(/@mailtion\.com$/i, "").trim();
      if (!local) {
        local = `user_${Math.random().toString(36).substring(2, 8)}`;
      }

      const res = await fetch("/api/v1/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || undefined,
          localPart: local,
          tag: newTag.trim() || undefined,
          note: newNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Mailbox created: ${data.item.address}`, "success");
        setShowCreateModal(false);
        setNewName("");
        setNewLocal("");
        setNewTag("");
        setNewNote("");
        fetchMailboxes();
      } else {
        toast(data.error || "Failed to create mailbox", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Edit Name & Metadata Handler
  const openEditModal = (item: MailboxItem) => {
    setEditingItem(item);
    setEditNameValue(item.name || "");
    setEditTagValue(item.tag || "");
    setEditNoteValue(item.note || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);

    try {
      const res = await fetch(`/api/v1/mailboxes/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editNameValue.trim() || null,
          tag: editTagValue.trim() || null,
          note: editNoteValue.trim() || null,
        }),
      });

      if (res.ok) {
        toast("Mailbox updated successfully!", "success");
        setEditingItem(null);
        fetchMailboxes();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update mailbox", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 font-sans">
      {/* Search, Filter & Quick Create Action Bar */}
      <div className="flex flex-col gap-3 sm:gap-4 rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 sm:top-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, address, tag..."
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-2 sm:py-2.5 pl-10 pr-4 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
          >
            <option value="" className="dark:bg-zinc-900">All Statuses</option>
            <option value="active" className="dark:bg-zinc-900">Active</option>
            <option value="paused" className="dark:bg-zinc-900">Paused</option>
            <option value="expired" className="dark:bg-zinc-900">Expired</option>
          </select>

          <input
            type="text"
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter tag..."
            className="w-full sm:w-36 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
          />

          {canCreateMultiple && (
            isAtLimit ? (
              <div className="col-span-2 sm:col-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => toast(`Tài khoản đã đạt hạn mức tối đa (${maxLimit} email).`, "error")}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-700 hover:bg-indigo-100/70 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 shadow-xs transition-all cursor-pointer"
                  title={`Đã đạt hạn mức tối đa ${maxLimit} email`}
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Hạn mức: {total}/{maxLimit} Email (Đã đầy)</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="col-span-2 sm:col-auto w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{isAdmin ? "Create Mailbox" : `+ Thêm email (${total}/${maxLimit})`}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar if selected */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-zinc-900/15 bg-zinc-100 p-2.5 sm:p-3 dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in">
          <div className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Selected <span className="text-zinc-900 dark:text-white font-bold">{selectedIds.length}</span> mailboxes
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkCopy}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Addresses</span>
            </button>
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export TXT</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-rose-500 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/80 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              <tr>
                <th className="w-10 sm:w-12 px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap">
                  <button
                    onClick={handleSelectAll}
                    disabled={selectableItems.length === 0}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors disabled:opacity-30 cursor-pointer"
                    title={selectableItems.length === 0 ? "No selectable mailboxes" : "Select all non-primary"}
                  >
                    {selectableItems.length > 0 && selectedIds.length === selectableItems.length ? (
                      <CheckSquare className="h-4 sm:h-4.5 w-4 sm:w-4.5 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Square className="h-4 sm:h-4.5 w-4 sm:w-4.5" />
                    )}
                  </button>
                </th>
                <th className="px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap">Mailbox &amp; Display Name</th>
                <th className="px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap">Tag / Note</th>
                <th className="px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap">Created Date</th>
                <th className="px-3 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs sm:text-sm text-zinc-400">
                    Loading data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs sm:text-sm text-zinc-400">
                    No mailboxes found. Click &quot;Create Mailbox&quot; above to get started.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  const isPrimary = item.is_primary === 1;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                        isPrimary ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                      }`}
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap">
                        {isPrimary ? (
                          <span
                            title="Primary account mailbox is protected and cannot be deleted"
                            className="inline-flex text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                          >
                            <Square className="h-4 sm:h-4.5 w-4 sm:w-4.5 opacity-30" />
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleSelectOne(item.id)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 sm:h-4.5 w-4 sm:w-4.5 text-zinc-900 dark:text-zinc-100" />
                            ) : (
                              <Square className="h-4 sm:h-4.5 w-4 sm:w-4.5" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                        <div className="min-w-[180px]">
                          {/* Display Name Prominently & Badges */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                              {item.name || item.local_part}
                            </span>
                            {isPrimary && (
                              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                <ShieldCheck className="h-3 w-3" />
                                <span>Primary</span>
                              </span>
                            )}
                            {item.name && (
                              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-medium text-zinc-500">
                                Named
                              </span>
                            )}
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit name / tag"
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Email address with copy */}
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                            <span className="font-mono text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                              {item.address}
                            </span>
                            <button
                              onClick={() => copyAddress(item.address, item.id)}
                              title="Copy email address"
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                        <div className="flex flex-col gap-1 max-w-[150px]">
                          {item.tag && (
                            <span className="inline-flex items-center gap-1 self-start rounded-full bg-blue-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              <Tag className="h-2.5 w-2.5" />
                              {item.tag}
                            </span>
                          )}
                          {item.note && (
                            <span className="truncate text-[11px] text-zinc-400" title={item.note}>
                              {item.note}
                            </span>
                          )}
                          {!item.tag && !item.note && (
                            <span className="text-[11px] text-zinc-300 dark:text-zinc-600">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 whitespace-nowrap text-xs text-zinc-500 font-medium">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          <button
                            onClick={() => onOpenInboxForMailbox(item.address)}
                            title="Open Inbox"
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Inbox className="h-4 w-4" />
                          </button>

                          {isPrimary ? (
                            <span
                              title="Primary mailbox is permanently active and cannot be deleted"
                              className="inline-flex items-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500 px-2 select-none"
                            >
                              Default
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleStatus(item.id, item.status)}
                                title={item.status === "active" ? "Pause mailbox" : "Activate mailbox"}
                                className={`rounded-lg p-1.5 cursor-pointer ${
                                  item.status === "active"
                                    ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                    : "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteSingle(item.id)}
                                title="Delete mailbox"
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">
              Total <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total}</span> mailboxes (Page {page}/{totalPages})
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-zinc-200 p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE SINGLE MAILBOX MODAL */}
      {canCreateMultiple && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Create 1 New Mailbox
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isAtLimit && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠️ Tài khoản của bạn chỉ được phép sở hữu tối đa 1 địa chỉ email. Bạn đã có 1 email chính nên không thể tạo thêm.
              </div>
            )}

            <form onSubmit={handleCreateSingle} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Prefix (Local Part)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newLocal}
                      onChange={(e) => setNewLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      placeholder="e.g. dev.testing or user123"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-3.5 pr-28 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 font-mono"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-zinc-400 font-mono select-none">
                      @mailtion.com
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewLocal(`box_${Math.random().toString(36).substring(2, 8)}`)}
                    className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
                    title="Generate random name"
                  >
                    <Dices className="h-3.5 w-3.5" />
                    <span>Random</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Testing Facebook, Account 1..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tag (Optional)
                </label>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g. social, work, verify..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Notes on usage purpose..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isAtLimit}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Confirm Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Edit Mailbox
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingItem.is_primary === 1 && (
              <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                <p className="font-bold flex items-center gap-1 mb-0.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Primary Account Mailbox
                </p>
                <p>This email address was created with your account and is permanently protected. Address cannot be modified or deleted. You can customize its display name, tag, and notes below.</p>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={editingItem.address}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-xs text-zinc-500 font-mono dark:border-zinc-700 dark:bg-zinc-800 select-all cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="e.g. Account Facebook, Netflix..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tag
                </label>
                <input
                  type="text"
                  value={editTagValue}
                  onChange={(e) => setEditTagValue(e.target.value)}
                  placeholder="e.g. social, work, test..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Note
                </label>
                <textarea
                  rows={2}
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:bg-white outline-none dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabMailboxes;
