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
      toast("Failed to load API keys", "error");
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
        toast(`API Key created: ${data.item.name}`, "success");
        setName("");
        fetchKeys();
      } else {
        toast(data.error || "Failed to create API key", "error");
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke key "${keyName}"? Applications using this key will lose access immediately.`)) return;
    try {
      const res = await fetch(`/api/v1/api-keys?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("API Key revoked");
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      toast("Could not revoke key", "error");
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    toast("API Key copied to clipboard");
    setTimeout(() => setCopiedKeyId(null), 1500);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Create Key Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            API Keys (For Automation &amp; Bots)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Authenticate external scripts, automation workers, and bot integrations.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Application name / Purpose (e.g. Python Bot, Registration Script)..."
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            className="flex sm:shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isCreating ? "Creating..." : "Create Key"}</span>
          </button>
        </form>
      </div>

      {/* Keys List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Active API Keys ({keys.length})
          </h3>
        </div>

        {keys.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No API keys created yet. Create one above to get started with API integrations.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {keys.map((k) => (
              <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                      {k.name}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Active
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {k.key}
                    </span>
                    <button
                      onClick={() => copyKey(k.key, k.id)}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Copy Key"
                    >
                      {copiedKeyId === k.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    <span>Created: {formatDate(k.created_at)}</span>
                    {k.last_used_at && (
                      <span className="ml-3">Last used: {formatDate(k.last_used_at)}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(k.id, k.name)}
                  className="self-end sm:self-center flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Revoke</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Guide */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/50 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            API Quickstart
          </h3>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Include your key in the HTTP header <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">X-API-Key</code>:
        </p>
        <pre className="rounded-lg bg-zinc-900 p-3 font-mono text-xs text-zinc-200 overflow-x-auto">
          curl -H &quot;X-API-Key: YOUR_API_KEY&quot; https://mailtion.com/api/v1/mailboxes
        </pre>
      </div>
    </div>
  );
}

export default TabApiKeys;
