"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Copy,
  Trash2,
  Power,
  Inbox,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  Plus,
  Edit2,
  X,
  Sparkles,
  Tag
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
  expires_at: string | null;
  created_at: string;
  message_count?: number;
  unread_count?: number;
}

interface TabMailboxesProps {
  onOpenInboxForMailbox: (address: string) => void;
  refreshTrigger: number;
}

export function TabMailboxes({ onOpenInboxForMailbox, refreshTrigger }: TabMailboxesProps) {
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
      toast("Không thể tải danh sách hộp thư", "error");
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
    toast(`Đã chép: ${address}`);
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
        toast(`Hộp thư chuyển sang trạng thái ${nextStatus === "active" ? "Hoạt động" : "Tạm dừng"}`);
      }
    } catch {
      toast("Không thể cập nhật trạng thái", "error");
    }
  };

  const deleteSingle = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa hộp thư này cùng toàn bộ email của nó?")) return;
    try {
      const res = await fetch(`/api/v1/mailboxes/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Đã xóa hộp thư");
        fetchMailboxes();
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      }
    } catch {
      toast("Không thể xóa hộp thư", "error");
    }
  };

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xác nhận xóa vĩnh viễn ${selectedIds.length} hộp thư đã chọn?`)) return;

    try {
      const res = await fetch("/api/v1/mailboxes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        toast(`Đã xóa ${selectedIds.length} hộp thư`);
        setSelectedIds([]);
        fetchMailboxes();
      }
    } catch {
      toast("Lỗi khi xóa hàng loạt", "error");
    }
  };

  const handleBulkCopy = () => {
    const selectedAddresses = items
      .filter((i) => selectedIds.includes(i.id))
      .map((i) => i.address);
    if (selectedAddresses.length === 0) return;

    navigator.clipboard.writeText(selectedAddresses.join("\n"));
    toast(`Đã chép ${selectedAddresses.length} địa chỉ mail đã chọn`);
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
    toast("Đã xuất tệp .txt");
  };

  // Quick Single Creation Handler
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      let local = newLocal.trim();
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
        toast(`Đã tạo hộp thư: ${data.item.address}`, "success");
        setShowCreateModal(false);
        setNewName("");
        setNewLocal("");
        setNewTag("");
        setNewNote("");
        fetchMailboxes();
      } else {
        toast(data.error || "Lỗi tạo hộp thư", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
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
        toast("Đã cập nhật thông tin hộp thư!", "success");
        setEditingItem(null);
        fetchMailboxes();
      } else {
        toast("Lỗi khi cập nhật", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search, Filter & Quick Create Action Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên hiển thị, email, nhãn (tag), ghi chú..."
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-2.5 pl-10 pr-4 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
          >
            <option value="" className="dark:bg-zinc-900">Tất cả trạng thái</option>
            <option value="active" className="dark:bg-zinc-900">Đang hoạt động</option>
            <option value="paused" className="dark:bg-zinc-900">Tạm dừng</option>
            <option value="expired" className="dark:bg-zinc-900">Hết hạn</option>
          </select>

          <input
            type="text"
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Lọc nhãn (Tag)..."
            className="w-36 rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
          />

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>+ Tạo 1 mail mới</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar if selected */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-900/15 bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Đã chọn <span className="text-zinc-900 dark:text-white font-bold">{selectedIds.length}</span> hộp thư
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleBulkCopy}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-all active:scale-[0.98]"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Chép địa chỉ</span>
            </button>
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-all active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Xuất TXT</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-rose-500 transition-all active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa đã chọn</span>
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/80 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              <tr>
                <th className="w-12 px-4 py-3.5">
                  <button
                    onClick={handleSelectAll}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    {selectedIds.length > 0 && selectedIds.length === items.length ? (
                      <CheckSquare className="h-4.5 w-4.5 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Square className="h-4.5 w-4.5" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3.5">Hộp thư & Tên gọi</th>
                <th className="px-4 py-3.5">Nhãn / Ghi chú</th>
                <th className="px-4 py-3.5">Ngày tạo</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-zinc-400">
                    Không tìm thấy hộp thư nào. Bấm nút &quot;+ Tạo 1 mail mới&quot; phía trên để bắt đầu.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => toggleSelectOne(item.id)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4.5 w-4.5 text-zinc-900 dark:text-zinc-100" />
                          ) : (
                            <Square className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          {/* Display Name Prominently */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {item.name || item.local_part}
                            </span>
                            {item.name && (
                              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[11px] font-medium text-zinc-500">
                                Đặt tên
                              </span>
                            )}
                            <button
                              onClick={() => openEditModal(item)}
                              title="Chỉnh sửa tên / nhãn"
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Email address with copy */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                              {item.address}
                            </span>
                            <button
                              onClick={() => copyAddress(item.address, item.id)}
                              title="Sao chép địa chỉ"
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          {item.tag && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                              <Tag className="h-3 w-3" />
                              #{item.tag}
                            </span>
                          )}
                          {item.note && (
                            <span className="text-xs text-zinc-500 truncate max-w-[180px]">
                              {item.note}
                            </span>
                          )}
                          {!item.tag && !item.note && <span className="text-zinc-400 text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenInboxForMailbox(item.address)}
                            title="Mở hộp thư này"
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 transition-colors"
                          >
                            <Inbox className="h-4 w-4" />
                            <span>Xem thư</span>
                          </button>

                          <button
                            onClick={() => toggleStatus(item.id, item.status)}
                            title={item.status === "active" ? "Tạm dừng nhận mail" : "Kích hoạt nhận mail"}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            <Power className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => deleteSingle(item.id)}
                            title="Xóa hộp thư"
                            className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">
            Tổng cộng: <span className="font-bold text-zinc-900 dark:text-zinc-100">{total}</span> hộp thư
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">
              Trang {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Create Single Mail Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Tạo 1 Hộp Thư Mới (Có Đặt Tên)
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSingle} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Tên gợi nhớ / Tên hiển thị
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Facebook Chính, TikTok Shop, Shopee..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Tên hòm thư (Bỏ trống để tạo ngẫu nhiên)
                </label>
                <div className="mt-1.5 flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden focus-within:border-zinc-900 dark:focus-within:border-zinc-300">
                  <input
                    type="text"
                    value={newLocal}
                    onChange={(e) => setNewLocal(e.target.value)}
                    placeholder="myname, nick123..."
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <span className="flex items-center px-3.5 text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 font-mono">
                    @mailtion.com
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Nhãn (Tag)
                  </label>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="shopee, fb..."
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Mục đích..."
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
                >
                  {isCreating ? "Đang tạo..." : "Tạo hộp thư ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Name & Info Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Đổi Tên & Thông Tin Hộp Thư
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Địa chỉ email
                </label>
                <div className="mt-1 font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {editingItem.address}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Tên hiển thị / Tên gợi nhớ
                </label>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="Nhập tên để dễ nhận biết..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Nhãn (Tag)
                </label>
                <input
                  type="text"
                  value={editTagValue}
                  onChange={(e) => setEditTagValue(e.target.value)}
                  placeholder="Tag phân loại..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value)}
                  placeholder="Ghi chú thêm..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-transparent px-3.5 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-300"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
                >
                  {isSavingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
