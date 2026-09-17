"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Plus, Trash2, Copy, Check, Terminal, Shield } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "./toast";

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  permissions: string;
  created_at: string;
  last_used_at: string | null;
}

export function TabApiKeys() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/api-keys");
      const data = await res.json();
      if (res.ok) {
        setKeys(data || []);
      }
    } catch {
      toast("Không thể tải danh sách API key", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), permissions: "all" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Đã tạo API Key: ${data.item.name}`, "success");
        setName("");
        fetchKeys();
      } else {
        toast(data.error || "Lỗi tạo API Key", "error");
      }
    } catch {
      toast("Lỗi kết nối", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, keyName: string) => {
    if (!confirm(`Bạn có chắc muốn thu hồi khóa "${keyName}"? Các tool dùng khóa này sẽ bị từ chối truy cập.`)) return;
    try {
      const res = await fetch(`/api/v1/api-keys?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Đã thu hồi API Key");
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      toast("Không thể xóa khóa", "error");
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast("Đã chép API Key");
    setTimeout(() => setCopiedKeyId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Create Key Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Khóa API (Dành cho Automation & Tool)
          </h2>
        </div>

        <form onSubmit={handleCreate} className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên ứng dụng / Mục đích (vd: Python Reg Bot, Auto Tool #1)..."
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="flex sm:shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isCreating ? "Đang tạo..." : "Tạo khóa mới"}</span>
          </button>
        </form>
      </div>

      {/* Keys List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Danh sách khóa đang hoạt động ({keys.length})
          </h3>
        </div>

        {keys.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            Chưa có khóa API nào. Hãy tạo một khóa để bắt đầu tích hợp.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      {k.name}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Hoạt động
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {k.key}
                    </span>
                    <button
                      onClick={() => copyKey(k.key, k.id)}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Sao chép khóa"
                    >
                      {copiedKeyId === k.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    Tạo: {formatDate(k.created_at)} • Dùng gần nhất: {k.last_used_at ? formatDate(k.last_used_at) : "Chưa sử dụng"}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDelete(k.id, k.name)}
                    className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Thu hồi</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code Snippets for Bot Developer */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-900 p-5 text-zinc-100 shadow-2xs dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span>Mẫu gọi API tạo mail hàng loạt (cURL & Python)</span>
        </div>

        <div className="space-y-3 font-mono text-[11px]">
          <div>
            <span className="text-zinc-400"># Tạo 50 mail ngẫu nhiên:</span>
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 p-3 text-emerald-400 border border-zinc-800">
{`curl -X POST https://your-vps.com/api/v1/mailboxes \\
  -H "Content-Type: application/json" \\
  -d '{"bulk": true, "mode": "random", "count": 50, "prefix": "bot", "tag": "reg_fb"}'`}
            </pre>
          </div>

          <div>
            <span className="text-zinc-400"># Lấy thư mới nhất và mã OTP của hộp thư:</span>
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 p-3 text-emerald-400 border border-zinc-800">
{`curl "https://your-vps.com/api/v1/messages?mailboxAddress=bot_123@mailtion.com&limit=1"`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
