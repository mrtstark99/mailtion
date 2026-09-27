"use client";

import React, { useState } from "react";
import { Copy, Download, Check, Sparkles, Plus, Dices, ArrowRight } from "lucide-react";
import { useToast } from "./toast";

interface MailboxItem {
  id: string;
  name?: string | null;
  address: string;
  local_part: string;
  domain: string;
  tag: string | null;
  created_at: string;
}

interface TabGeneratorProps {
  onGenerated?: () => void;
  onSuccessCreated?: () => void;
  onNavigateToMailboxes?: () => void;
}

export function TabGenerator({ onGenerated, onSuccessCreated, onNavigateToMailboxes }: TabGeneratorProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "random" | "pattern" | "custom">("random");

  // Single creation state
  const [singleName, setSingleName] = useState<string>("");
  const [singleLocal, setSingleLocal] = useState<string>("");

  // Bulk creation state
  const [count, setCount] = useState<number>(20);
  const [prefix, setPrefix] = useState<string>("user");
  const [pattern, setPattern] = useState<string>("acc_{i}");
  const [customList, setCustomList] = useState<string>("");

  // Common metadata
  const [tag, setTag] = useState<string>("");
  const [expiryHours, setExpiryHours] = useState<string>("0");
  const [note, setNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedList, setGeneratedList] = useState<MailboxItem[]>([]);
  const [singleCreated, setSingleCreated] = useState<MailboxItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const generateRandomSingle = () => {
    const hex = Math.random().toString(36).substring(2, 8);
    setSingleLocal(`user_${hex}`);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "single") {
        let local = singleLocal.trim().replace(/@mailtion\.com$/i, "").trim();
        if (!local) {
          local = `user_${Math.random().toString(36).substring(2, 8)}`;
        }

        const res = await fetch("/api/v1/mailboxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: singleName.trim() || undefined,
            localPart: local,
            tag: tag.trim() || undefined,
            note: note.trim() || undefined,
            expiryHours: parseInt(expiryHours, 10) || undefined,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          toast(`Mailbox created: ${data.item.address}`, "success");
          setSingleCreated(data.item);
          setGeneratedList([]);
          if (onGenerated) onGenerated();
          if (onSuccessCreated) onSuccessCreated();
        } else {
          toast(data.error || "Failed to create mailbox", "error");
        }
      } else {
        // Bulk mode
        const payload: Record<string, unknown> = {
          bulk: true,
          mode,
          tag: tag.trim() || undefined,
          note: note.trim() || undefined,
          expiryHours: parseInt(expiryHours, 10) || undefined,
        };

        if (mode === "random") {
          payload.count = count;
          payload.prefix = prefix.trim() || "user";
        } else if (mode === "pattern") {
          payload.count = count;
          payload.pattern = pattern.trim() || "acc_{i}";
        } else if (mode === "custom") {
          const list = customList
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (list.length === 0) {
            toast("Please enter at least one address or local part", "error");
            setIsLoading(false);
            return;
          }
          payload.customList = list;
        }

        const res = await fetch("/api/v1/mailboxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          toast(`Successfully created ${data.createdCount} mailboxes!`, "success");
          setGeneratedList(data.items || []);
          setSingleCreated(null);
          if (onGenerated) onGenerated();
          if (onSuccessCreated) onSuccessCreated();
        } else {
          toast(data.error || "Bulk generation error", "error");
        }
      }
    } catch {
      toast("Connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const copyAllToClipboard = () => {
    if (generatedList.length === 0) return;
    const text = generatedList.map((m) => m.address).join("\n");
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast(`Copied ${generatedList.length} email addresses to clipboard`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (generatedList.length === 0) return;
    const text = generatedList.map((m) => m.address).join("\r\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mailtion_emails_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Downloaded .txt file");
  };

  const downloadCsv = () => {
    if (generatedList.length === 0) return;
    const rows = [
      ["Name", "Address", "Local Part", "Domain", "Tag", "Created At"],
      ...generatedList.map((m) => [m.name || "", m.address, m.local_part, m.domain, m.tag || "", m.created_at]),
    ];
    const csvContent = rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mailtion_emails_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Downloaded .csv file");
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Mailbox Generator Tool
          </h2>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "random", label: "Random Bulk" },
            { id: "pattern", label: "Pattern (Prefix_{i})" },
            { id: "custom", label: "Custom Text List" },
            { id: "single", label: "Single Mailbox" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id as "single" | "random" | "pattern" | "custom")}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                mode === t.id
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="mt-5 space-y-4">
          {mode === "single" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Prefix (Local Part)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={singleLocal}
                      onChange={(e) => setSingleLocal(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      placeholder="e.g. dev.testing"
                      className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900 font-mono"
                    />
                    <span className="absolute right-3 top-2 text-xs text-zinc-400 font-mono">
                      @mailtion.com
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomSingle}
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
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
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="e.g. Testing Facebook, Account 1..."
                  className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          )}

          {mode === "random" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Prefix
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g. user, test, bot"
                  className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {mode === "pattern" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Pattern Template (use &#123;i&#125;)
                </label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="acc_{i} or tester_{i}"
                  className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Custom Address List (1 address per line)
              </label>
              <textarea
                rows={5}
                value={customList}
                onChange={(e) => setCustomList(e.target.value)}
                placeholder="alice&#10;bob&#10;charlie@mailtion.com"
                className="w-full rounded-lg border border-zinc-200 bg-transparent p-3 text-xs sm:text-sm font-mono text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>
          )}

          {/* Common Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Tag (Optional)
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. social, campaign_a"
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Expiry (Hours, 0 = Forever)
              </label>
              <input
                type="number"
                min={0}
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional notes"
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isLoading ? "Generating..." : "Generate Mailboxes"}</span>
          </button>
        </form>

        {/* Results */}
        {generatedList.length > 0 && (
          <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Generated {generatedList.length} mailboxes successfully!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyAllToClipboard}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy All</span>
                </button>
                <button
                  type="button"
                  onClick={downloadTxt}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .TXT</span>
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .CSV</span>
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950/60 divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
              {generatedList.map((m) => (
                <div key={m.id} className="py-1 flex items-center justify-between">
                  <span>{m.address}</span>
                  {m.name && <span className="text-zinc-400 text-[11px] font-sans">[{m.name}]</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TabGenerator;
